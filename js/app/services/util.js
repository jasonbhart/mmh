;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('util', ['appConfig', function(appConfig) {
        return {
            /**
             * @param string path
             * @returns absolute path (including app path)
             */
            getPath: function(path) {
                if (!path || typeof(path) !== 'string')
                    return null;
                
                var absPath = appConfig.basePath;
                if (!appConfig.basePath.endsWith('/') && !path.startsWith('/'))
                    absPath += '/';
                absPath += path;
                return absPath;
            }
        };
    }]);
})();
