;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    function User(id, $rootScope, $q, appConfig, $firebaseObject, $firebaseArray, $log, authProviders, util) {
        var resultDefer = $q.defer();
        
        var ref = new Firebase(appConfig.firebaseUrl + '/users');
        var meetRef = new Firebase(appConfig.firebaseUrl + '/meets');
        ref = ref.child(id);
        ref.once('value', function (snap) {
            if (!snap.exists()) {
                $rootScope.$applyAsync(function() {
                    resultDefer.reject();
                });
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
                meetingList: $firebaseObject(ref.child('meetings')),
                isAnonymous: function() {
                    return this.user.provider == authProviders.ANONYMOUS;
                },
                getProfileImageURL: function() {
                    if (!this.user.profileImageURL)
                        return util.getAbsPath('/images/no-profile.jpg');

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
                /**
                 * @param {Object} location { coords: {lat:, lng:}, radius:, shortName: }
                 */
                updateLocation: function(location) {
                    this.user.location = location;
                    $log.log(this.user);
                    this.user.$save().then(function (ref) {
                        $log.log("Change location success for user " + id);
                    }, function (error) {
                        $log.log("user.js - change location error");
                    });
                },
                getDisableEmailNoti: function() {
                    if (this.user.disableEmailNoti)
                        return this.user.disableEmailNoti;
                    return false;
                },
                setDisableEmailNoti: function(value) {
                    this.user.disableEmailNoti = value;
                    this.user.$save().then(function (ref) {
                        $log.log("Change disableEmailNoti success for user " + id);
                    }, function (error) {
                        $log.log("user.js - change disableEmailNoti error");
                        return false;
                    });
                    
                    return true;
                },
                removePassedActivities: function () {
                    var meetingList = this.meetingList;
                    _.forEach(meetingList, function(meeting, meetingId) {
                        if (meeting && meeting.id) {
                            if (moment().diff(moment(meeting.createdDate)) > 86400 * 1000) {
                                delete meetingList[meetingId];
                            }
                        }
                        
                    });
                    meetingList.$save();
                },
                removeUnusedActivities: function (userId) {
                    var meetingList = this.meetingList;
                    _.forEach(meetingList, function(meeting, meetingId) {
                        if (meeting && meeting.id) {
                            var userOption = $firebaseObject(meetRef.child(meetingId).child('users').child(userId));
                            
                            userOption.$loaded().then(function(data) {
                                if (!data.when && !data.where) {
                                    delete meetingList[meetingId];
                                    meetingList.$save();
                                    console.log('removed meeting', meetingId);
                                }
                            });
                        }
                    });
                }
            };

            userObj.user.$loaded(function() {
                $rootScope.$applyAsync(function() {
                    resultDefer.resolve(userObj);
                });
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
                
                if (data.email) {
                    userData.email = data.email;
                }
                
                if (data.loggedViaSocial) {
                    userData.loggedViaSocial = true;
                }
                
                ref.once('value', function(snap) {
                    if (!snap.exists()) {
                        userData.createdDate = moment().utc().toISOString();
                    } else {
                        if (data.provider === "anonymous") {
                            service.get(data.id).then(function(user) {
                                $rootScope.$applyAsync(function() {
                                    defer.resolve(user);
                                });
                            }, function(error) {
                                $rootScope.$applyAsync(function() {
                                    defer.reject(error);
                                });
                            });
                            return true;
                        }
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
            addMeetingToUser: function(userId, meetingData) {
                var defer = $q.defer();
                var ref = new Firebase(appConfig.firebaseUrl + '/users').child(userId);

                ref.child('meetings').child(meetingData.id).once('value', function(snapshot) {
                    // if meeting does not exist
                    if (snapshot.val() === null) {
                        ref.child('meetings').child(meetingData.id).set(meetingData, function(error) {
                            if (error)
                                defer.reject(error);
                            else
                                defer.resolve();
                        });
                    }
                    
                    defer.resolve();
                }); 
                
                return defer.promise;
            },
            get: function(id) {
                return new User(id, $rootScope, $q, appConfig, $firebaseObject, $firebaseArray, $log, authProviders, util);
            },
            delete: function(id) {
                var defer = $q.defer();
                var ref = new Firebase(appConfig.firebaseUrl + '/users').child(id);
                ref.remove(function(error) {
                    if (error)
                        defer.reject(error);
                    else
                        defer.resolve();
                });
                
                return defer.promise;
            }
        };
        
        return service;
    }]);
})();
