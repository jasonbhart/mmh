;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    function User(id, $q, appConfig, $firebaseObject, $firebaseArray, $log) {
        var resultDefer = $q.defer();
        
        var ref = new Firebase(appConfig.firebaseUrl + '/users');
        ref = ref.child(id);
        ref.once('value', function (snap) {
            if (!snap.exists()) {
                resultDefer.reject();
                return;
            }

            // prepare meeting object
            var refs = {
                current: ref,                               // current user 
            }

            var userObj = {
                refs: refs,
                user: $firebaseObject(refs.current),
                getProfilePictureUrl: function() {
                    if (this.user.facebookid)
                        return '//graph.facebook.com/' + this.user.facebookid + '/picture?width=100&height=100';
                    return null;
                },
                getLocationName: function() {
                    if (this.user.location)
                        return this.user.location.shortName;
                    return 'Unknown';
                }
            };

            userObj.user.$loaded(function() {
                resultDefer.resolve(userObj);    
            })
        });
        
        return resultDefer.promise;
    }

    app.factory('userService', ['$q', '$firebaseObject', '$firebaseArray', '$log', 'appConfig', function($q, $firebaseObject, $firebaseArray, $log, appConfig) {
        return {
            get: function(id) {
                return new User(id, $q, appConfig, $firebaseObject, $firebaseArray, $log);
            }
        };
    }]);
})();
