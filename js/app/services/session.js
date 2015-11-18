;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('authProviders', function() {
        return {
            ANONYMOUS: 'anonymous',
            FACEBOOK: 'facebook'
        };
    });

    app.factory('sessionService', ['$rootScope', '$q', '$cookies', '$log', '$firebaseAuth', 'appConfig', 'authProviders', 'userService', 'meetingService', 'geoLocation', '$window', 'util',
            function($rootScope, $q, $cookies, $log, $firebaseAuth, appConfig, authProviders, userService, meetingService, geoLocation, $window, util) {
        var ref = new Firebase(appConfig.firebaseUrl);
        var authObj = $firebaseAuth(ref);
        var readyDefer = $q.defer();
        var currentUser = null;
        var service;
        var loggingIn = false;
        var loggingOut = false;
        var previousGuid = null;
        var lastLoggedGuid = null;
        var meetingId = null;

        var setAuth = function(authData) {
            if (authData) {
                
                if (authData.provider == authProviders.FACEBOOK) {
                    ref.child('facebook').child(authData.uid).once('value', function(snapshot){
                        var facebookData = snapshot.val();
                        if (facebookData) {
                            previousGuid = $cookies.guid || null;
                            $cookies.guid = facebookData.guid;
                            if (loggingIn) {
                                var overwrite = (lastLoggedGuid === $cookies.guid);
                                service.migrate(meetingId, previousGuid, $cookies.guid, false, overwrite);
                                loggingIn = false;
                            }
                        } else {
                            ref.child('facebook').child(authData.uid).set({guid: $cookies.guid || authData.uid, name: authData.facebook.displayName});
                        }
                        loadUserFromCookie(authData);
                    });
                } else {
                    loadUserFromCookie(authData);
                }
            } else {
                // no auth data? try authenticate anonymously
                authObj.$authAnonymously()
                    .catch(function() {
                        readyDefer.reject('Can\'t authenticate anonmously');
                    });
            }
        };
        
        function loadUserFromCookie(authData) {
            if ($cookies.guid) {
                ref.child('users').child($cookies.guid).once('value', function(snapshot) {
                    var userData = snapshot.val() || {
                        id: authData.uid,
                        provider: authData.provider
                    };
                    saveUser(userData, authData);
                });
            } else {
                $cookies.guid = authData.uid;
                var userData = {
                    id: authData.uid,
                    provider: authData.provider
                };
                saveUser(userData, authData);
                if (loggingOut) {
                    service.migrate(meetingId, previousGuid, $cookies.guid, true, false);
                    loggingOut = false;
                }
            }
        }
        
        function saveUser(userData, authData) {
            userData.provider = authData.provider;
            if (authData.provider == authProviders.FACEBOOK) {
                userData.fullName = authData.facebook.displayName,
                userData.profileImageURL = authData.facebook.profileImageURL;
                userData.email = authData.facebook.email || null;
                userData.loggedViaSocial = true;
            } else if (authData.provider == authProviders.ANONYMOUS) {
                userData.fullName = 'Anonymous';
                userData.profileImageURL = null;
                userData.email = null;
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
                //service.migrate();
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
        }

        var currentPage = util.getCurrentPage();
        service = {
            // state transitions
            states: {
                LOGIN: 1,   // anonymous -> authenticated
                LOGOUT: 2   // authenticated -> anonymous
            },
            ready: readyDefer.promise,
            setMeetingId: function(id) {
                meetingId = id;
            },
            getViewedTutorialStatus: function() {
                if (currentPage === 1 && $cookies.viewedHomeTutorial) {
                    return true;
                } else if (currentPage === 2 && $cookies.viewedMeetingTutorial) {
                    return true;
                } else if (currentPage === 3 && $cookies.viewedNewMeetTutorial) {
                    return true;
                } else {
                    return false;
                }
            },
            setViewedTutorialStatus: function() {
                if (currentPage === 1) {
                    $window.$.cookie("viewedHomeTutorial", 1, { expires : 10000 });
                } else if (currentPage === 2) {
                    $window.$.cookie("viewedMeetingTutorial", 1, { expires : 10000 });
                } else if (currentPage === 3) {
                    $window.$.cookie("viewedNewMeetTutorial", 1, { expires : 10000 });
                }
            },
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
                        loggingIn = true;
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
                previousGuid = $cookies.guid;
                lastLoggedGuid = $cookies.guid;
                loggingOut = true;
                delete $cookies.guid;
                authObj.$unauth();
            },
            getCurrentUser: function() {
                return currentUser;
            },
            /**
             * Migrate data from anonymous user to current user
             */
            migrate: function(meetingId, srcUser, desUser, keepSrc, overwrite) {
                if (!meetingId || !$cookies.guid || !desUser || srcUser === desUser)
                    return;
                meetingService.migrateUser(meetingId, srcUser, desUser, keepSrc, overwrite).then(function() {
                    console.log('migrated user', srcUser, desUser);
                });
            }
        };
        
        return service;
    }]);
})();
