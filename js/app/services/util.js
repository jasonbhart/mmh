;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('util', ['appConfig', function(appConfig) {
        return {
            joinPaths: function() {
                if (arguments.length == 0)
                    return null;

                var paths = [],
                    count = arguments.length-1;

                var path;
                for (var i=0; i <= count; i++) {
                    if (i == 0)
                        path = arguments[i].replace(/\/+$/, '');
                    else if (i == count)
                        path = arguments[i].replace(/^\/+/, '');
                    else
                        path = arguments[i].replace(/^\/+|\/+$/g, '');

                    if (!path)
                        continue;
                    paths.push(path);
                }

                return paths.join('/');
            },
            /**
             * @param string path
             * @returns absolute path (including app path)
             */
            getAbsPath: function(path) {
                if (!path || typeof(path) !== 'string')
                    return null;

                return this.joinPaths(appConfig.basePath, path);
            },
            convertMilesToKms: function(miles) {
                return miles * 1.609344;
            }
        };
    }]);
})();
