;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    function User(id, $q, appConfig, $firebaseObject, $firebaseArray, $log, authProviders, util) {
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
                id: id,
                refs: refs,
                user: $firebaseObject(refs.current),
                isAnonymous: function() {
                    return this.user.provider == authProviders.ANONYMOUS;
                },
                getProfileImageURL: function() {
                    if (!this.user.profileImageURL)
                        return util.getPath('/images/no-profile.jpg');

                    return this.user.profileImageURL;
//                    if (this.user.provider == authProviders.FACEBOOK)
//                        return '//graph.facebook.com/' + this.user.serviceId + '/picture?width=100&height=100';
//                    return null;
                },
                getLocationName: function() {
                    if (this.user.location)
                        return this.user.location.shortName;
                    return 'Unknown';
                },
                getLocation: function() {
                    if (this.user.location)
                        return this.user.location;
                    return null;
                },
                updateLocation: function(location) {
                    this.user.location = location;
                    $log.log(this.user);
                    this.user.$save().then(function (ref) {
                        $log.log("Change location success for user " + id);
                    }, function (error) {
                        $log.log("user.js - change location error");
                    });
                }
            };

            userObj.user.$loaded(function() {
                resultDefer.resolve(userObj);    
            })
        });
               
        return resultDefer.promise;
    }

    app.factory('userService',
        ['$rootScope', '$q', '$firebaseObject', '$firebaseArray', '$log', 'appConfig', 'authProviders', 'util',
            function($rootScope, $q, $firebaseObject, $firebaseArray, $log, appConfig, authProviders, util) {
        var service = {
            /*
             * { provider: 'facebook', id: 'UID', fullName: 'Full name', profileImageURL: '...' }
             */
            createOrUpdate: function(data) {
                var defer = $q.defer();
                var ref = new Firebase(appConfig.firebaseUrl + '/users').child(data.id);

                var userData = {
                    id: data.id,
                    provider: data.provider,
                    fullName: data.fullName,
                    profileImageURL: data.profileImageURL
                };
                
                ref.once('value', function(snap) {
                    if (!snap.exists()) {
                        userData.createdDate = moment().utc().toISOString();
                    }
                    
                    ref.update(userData, function(error) {
                        if (error) {
                            $rootScope.$applyAsync(function() {
                                defer.reject(error);
                            });
                            return;
                        }

                        var userId = ref.key();

                        if (userData.createdDate)
                            $log.log("New User created", userId);
                        else
                            $log.log("User updated", userId);

                        // load meeting data
                        service.get(userId).then(function(user) {
                            $rootScope.$applyAsync(function() {
                                defer.resolve(user);
                            });
                        }, function(error) {
                            $rootScope.$applyAsync(function() {
                                defer.reject(error);
                            });
                        });
                    });
                });
                
                return defer.promise;
            },
            get: function(id) {
                return new User(id, $q, appConfig, $firebaseObject, $firebaseArray, $log, authProviders, util);
            }
        };
        
        return service;
    }]);
})();
