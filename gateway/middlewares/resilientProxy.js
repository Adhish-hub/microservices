const {createProxyMiddleware} = require("http-proxy-middleware");

function createResilientProxy({
    target,
    pathRewrite,
    timeout = 5000,
    failureThreshold = 5,
    resetTimeout = 15000,
}){
    let failureCount = 0;
    let circuitState = "closed";
    let openedAt = 0;
    let halfOpenRequestInProgress = false;

    function recordFailure(){
        failureCount += 1;

        console.error(
          `Circuit breaker failure for ${target}: ${failureCount}/${failureThreshold}`,
        );

        if(failureCount >= failureThreshold){
            circuitState = "OPEN";
            openedAt = Date.now();

            console.error(
              `Circuit OPEN for ${target}. Requests will fail fast for ${
                resetTimeout / 1000
              } seconds.`,
            );
        }
    }

    function recordSuccess(){
        failureCount = 0;
        circuitState = "CLOSED";
        openedAt = 0;
        halfOpenRequestInProgress = false;
    }

    function circuitMiddleware(req, res, next){
        if(circuitState == "OPEN"){
            const elapsed = Date.now() - openedAt;

            if(elapsed < resetTimeout){
                return res.status(503).json({
                    message: "Service temporarily unavailable. Please try again later.",
                });
            }

            circuitState = "HALF_OPEN";
            halfOpenRequestInProgress = false;

            console.log(`Circuit HALF_OPEN for ${target}.`);
        }

        if(circuitState === "HALF_OPEN"){
            if(halfOpenRequestInProgress){
                return res.status(503).json({
                    message: "Service temporarily available. Please try again later.",
                });
            }
            halfOpenRequestInProgress = true;
        }
        next()
    }

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,

      ...(pathRewrite ? { pathRewrite } : {}),

      /*
       * Maximum time the proxy waits for the upstream service.
       */
      proxyTimeout: timeout,

      /*
       * Maximum time allowed for the incoming proxy request.
       */
      timeout,

      onProxyReq: (proxyReq, req) => {
        /*
         * Preserve the authenticated identity supplied by
         * the Gateway middleware.
         */
        if (req.user) {
          proxyReq.setHeader("x-user-id", req.user.userId);
          proxyReq.setHeader("x-user-role", req.user.role);
        }
      },

      onProxyRes: (proxyRes, req, res) => {
        const statusCode = proxyRes.statusCode || 500;

        /*
         * 5xx means the upstream service failed.
         *
         * 4xx is NOT a circuit-breaker failure because the
         * service itself successfully handled the request.
         */
        if (statusCode >= 500) {
          recordFailure();
        } else {
          recordSuccess();
        }
      },

      onError: (error, req, res) => {
        console.error(`Gateway proxy error for ${target}:`, error.message);

        recordFailure();

        if (!res.headersSent) {
          res.status(503).json({
            message: "Upstream service unavailable.",
          });
        }
      },
    });

    return [circuitMiddleware, proxy];
}

module.exports = {createResilientProxy};