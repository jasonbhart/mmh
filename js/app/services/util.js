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
            },
            getUrlParams: function(name) {
                var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
                if (results == null){
                    return null;
                }
                else{
                    return results[1] || 0;
                }
            },
            getCurrentPage: function() {
                if (window.location.href.indexOf('meet_me_here') > -1) {
                    return 4;              // meet me here
                }
                else if (window.location.href.indexOf('create_new_activity') > -1) {
                    return 3;              // new meet page
                } else if (window.location.href.indexOf('activity') > -1) {
                    return 2;              // meeting page
                } else {
                    return 1;              // homepage
                }
            }, 
            addEventToDataLayer: function(category, action, label, value) {
                try {
                    var data = {
                        'event': 'event', 
                        'eventCategory': category,
                        'eventAction': action,
                        'eventLabel': label,
                        'eventValue': value
                    }; 

                    dataLayer.push(data);

                } catch (e) {
                    console.log(e);
                }
            }
        }
    }]);
})();
