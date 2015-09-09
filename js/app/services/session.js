;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('authProviders', function() {
        return {
            ANONYMOUS: 'anonymous',
            FACEBOOK: 'facebook'
        };
    });

    app.factory('sessionService', ['$rootScope', '$q', '$cookies', '$log', '$firebaseAuth', 'appConfig', 'authProviders', 'userService', 'meetingService', 'geoLocation',
            function($rootScope, $q, $cookies, $log, $firebaseAuth, appConfig, authProviders, userService, meetingService, geoLocation) {
        var ref = new Firebase(appConfig.firebaseUrl);
        var authObj = $firebaseAuth(ref);
        var readyDefer = $q.defer();
        var currentUser = null;
        var service;

        var setAuth = function(authData) {
            console.log('AUTH', authData, angular.copy(authData));
            if (authData) {
                $log.log('sessionService: Auth data', authData);
                var userData = {
                    id: authData.uid,
                    provider: authData.provider,
                    fullname: 'Unknown',
                    profileImageURL: null
                };

                if (authData.provider == authProviders.FACEBOOK) {
                    userData.fullName = authData.facebook.displayName,
                    userData.profileImageURL = authData.facebook.profileImageURL;
                } else if (authData.provider == authProviders.ANONYMOUS) {
                    userData.fullName = 'Anonymous';
                    $cookies.lastAnonymousId = authData.uid;
                }

                // state changes
                var stateTransition = null;
                if ($cookies.lastUserProvider) {
                    // user logout
                    if ($cookies.lastUserProvider != authProviders.ANONYMOUS
                        && authData.provider == authProviders.ANONYMOUS)
                        stateTransition = service.states.LOGOUT;
                    else if ($cookies.lastUserProvider == authProviders.ANONYMOUS
                        && authData.provider != authProviders.ANONYMOUS)
                        stateTransition = service.states.LOGIN;
                }

                $cookies.lastUserProvider = authData.provider;

                userService.createOrUpdate(userData).then(function(user) {
                    currentUser = user;
                    service.migrate();
                    if (!user.user.location) {
                        geoLocation.getCurrentLocation()
                            .then(
                                function(location) {
                                    location.radius = appConfig.defaultRadius;
                                    user.updateLocation(location);
                                    $log.log('geoLocation success', location);
                                }, function(error) {
                                    $log.log('geoLocation error', error);
                                }
                            );
                    }

                    readyDefer.promise.then().then(function() {
                        $rootScope.$broadcast('auth.changed', user, stateTransition);
                    });

                    readyDefer.resolve();
                }, function() {
                    readyDefer.reject('Can\'t create or update user');
                });
            } else {
                // no auth data? try authenticate anonymously
                authObj.$authAnonymously()
                    .catch(function() {
                        readyDefer.reject('Can\'t authenticate anonmously');
                    });
            }
        }

        service = {
            // state transitions
            states: {
                LOGIN: 1,   // anonymous -> authenticated
                LOGOUT: 2   // authenticated -> anonymous
            },
            ready: readyDefer.promise,
            init: function() {
                authObj.$waitForAuth().then(function() {
                    // for some reason onAuth is not raised during login (for auth redirect mode)
                    // when registered outside of this callback
                    authObj.$onAuth(function(authData) {
                        setAuth(authData);
                    });
                });
            },
            login: function(provider, remember) {
                remember = false;   // TODO:

                var authDefer = $q.defer();
                var options = { remember: remember };

                authObj.$authWithOAuthPopup(provider, options)
                    .then(function(authData) {
                        authDefer.resolve(authData);
                    }, function(error) {
                        if (error.code == 'TRANSPORT_UNAVAILABLE') {
                            authObj.$authWithOAuthRedirect(provider, options)
                                .then(function(authData) {
                                    authDefer.resolve(authData);
                                }, function(error) {
                                    authDefer.reject(error);
                                });
                        } else {
                            authDefer.reject(error);
                        }
                    });
                
                return authDefer.promise;
            },
            logout: function() {
                authObj.$unauth();
            },
            getCurrentUser: function() {
                return currentUser;
            },
            /**
             * Migrate data from anonymous user to current user
             */
            migrate: function() {
                if (!$cookies.lastAnonymousId || !currentUser || currentUser.user.provider == authProviders.ANONYMOUS)
                    return;

                meetingService.copyData($cookies.lastAnonymousId, currentUser.id, true).then(function() {
                    userService.delete($cookies.lastAnonymousId);
                    delete $cookies.lastAnonymousId;
                });
            }
        };
        
        return service;
    }]);
})();
