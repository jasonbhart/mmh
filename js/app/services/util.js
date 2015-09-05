;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('util', ['appConfig', function(appConfig) {
        return {
            /**
             * @param string path
             * @returns absolute path (including app path)
             */
            getAbsPath: function(path) {
                if (!path || typeof(path) !== 'string')
                    return null;
                
                var absPath = appConfig.basePath;
                if ((!absPath || absPath[absPath.length-1] != '/')
                        && path[0] != '/')
                    absPath = absPath ? absPath + '/' : '/';
                absPath += path;
                return absPath;
            },
            convertMilesToKms: function(miles) {
                return miles * 1.609344;
            }
        };
    }]);
})();
