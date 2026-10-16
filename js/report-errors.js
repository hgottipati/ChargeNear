(function () {
    if (['localhost', '127.0.0.1'].includes(location.hostname)) return;

    var sent = 0;
    function send(message, source, stack) {
        if (sent >= 5) return;
        sent += 1;
        var body = JSON.stringify({
            message: String(message || 'Unknown error'),
            source: source || '',
            stack: stack || '',
            page: location.pathname
        });
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }));
        } else {
            fetch('/api/log', { method: 'POST', body: body, keepalive: true });
        }
    }

    window.addEventListener('error', function (event) {
        var error = event.error;
        send(event.message, event.filename + ':' + event.lineno, error && error.stack);
    });

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason || {};
        send(reason.message || reason, 'unhandledrejection', reason.stack);
    });
})();
