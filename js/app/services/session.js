;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('authProviders', function() {
        return {
            ANONYMOUS: 'anonymous',
            FACEBOOK: 'facebook'
        };
    });

    app.factory('sessionService', ['$rootScope', '$q', '$log', '$firebaseAuth', 'appConfig', 'authProviders', 'userService', function($rootScope, $q, $log, $firebaseAuth, appConfig, authProviders, userService) {
        var ref = new Firebase(appConfig.firebaseUrl);
        var authObj = $firebaseAuth(ref);
        var readyDefer = $q.defer();
        var currentUser = null;

        var service = {
            ready: readyDefer.promise,
            init: function() {
                authObj.$onAuth(function(authData) {
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
                            userData.profileImageURL = 'TODO_url_to_anonymous_picture';    // TODO:
                        }

                        userService.createOrUpdate(userData).then(function(user) {
                            currentUser = user;
                            $rootScope.$broadcast('auth.changed', user);                
                            readyDefer.resolve();
                        }, function() {
                            readyDefer.reject('Can\'t create or update user');
                        });
                    } else {
                        // no auth data? try authenticate anonymously
                        authObj.$authAnonymously().catch(function() {
                            readyDefer.reject('Can\'t authenticate anonmously');
                        });
                    }
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
            }
        };
        
        return service;
    }]);
})();
