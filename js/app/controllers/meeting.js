;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null){
            return null;
        }
        else{
            return results[1] || 0;
        }
    };
    
    app.controller('meetingController', ['$scope', '$q', '$log', '$firebaseArray', 'dialogs', 'dataProvider', 'sessionService', 'meetingService', 'userService', 'geoLocation', 'userGroupBuilder','$window',
            function($scope, $q, $log, $firebaseArray, dialogs, dataProvider, sessionService, meetingService, userService, geoLocation, userGroupBuilder, $window) {

        // get from the session
        $scope.timeFormat = 'h:mmA';
        $scope.meetingId = null;
        $scope.meeting = null;
        $scope.meetingUser = null;
        $scope.userGroups = null;
        $scope.currentUser = null;

        
        var formattingData = {
            where: [],
            when: [],
            setWhere: function(meetingWhere) {
                this.where = meetingWhere;
            },
            formatWhere: function(userWhere) {
                userWhere = _.map(userWhere, function(where) {
                    return where.$value;
                });

                var formatted = _.map(this.where, function(where) {
                    return {
                        id: where.$id,
                        where: where,
                        name: where.name,
                        selected: userWhere.indexOf(where.$id) >= 0
                    };
                });

                return formatted;
            },
            setWhen: function(meetingWhen) {
                this.when = _.map(meetingWhen, function(when) {
                    var time = meetingService.convertWhen(when.$value);
                    return {
                        id: when.$id,
                        when: time
                    };
                }).sort(function(a, b) {
                    if (a.when < b.when)
                        return -1;
                    else if (a.when > b.when)
                        return 1;
                    return 0;
                });
            },
            formatWhen: function(userWhen, timeFormat) {
                userWhen = _.map(userWhen, function(when) {
                    return when.$value;
                });
                
                var formatted = _.map(this.when, function(when) {
                    return {
                        id: when.id,
                        when: when.when,
                        whenFormatted: when.when.format(timeFormat),
                        selected: userWhen.indexOf(when.id) >= 0
                    };
                });

                return formatted;
            }
        };

        var usersWatchList = {};            // watches

        // formatted data
        $scope.usersInfo = {
            currentId: null,
            current: null,
            others: {},
            all: {},
            count: 0,
            add: function(id, info) {
                this.all[id] = info;
                if (id == this.currentId) {
                    this.current = info;
                } else {
                    this.others[id] = info;
                }
                this.count++;
            },
            remove: function(id) {
                if (id == this.currentId) {
                    this.current = null;
                    this.currentId = null;
                } else {
                    delete this.others[id];
                }
                
                delete this.all[id];
                this.count--;
            },
            setCurrentId: function(id) {
                if (id == this.currentId)
                    return;

                if (this.currentId !== null && this.current)
                    this.others[this.currentId] = this.current;
                
                this.current = this.others[id];
                delete this.others[id];
                this.currentId = id;
            }
        };

        // this will set/change meetingUser when both user auth and meeting will be available
        var meetingUserSentinel = (function() {
            var user = null,
                meeting = null;

            var setMeetingUser = function(meetingUser) {
                $scope.$applyAsync(function() {
                    $scope.meetingUser = meetingUser;
                });
            }

            var trySet = function() {
                if (user && meeting) {
                    meeting.addUser(user.id).then(function() {
                        meeting.getUser(user.id).then(function(meetingUser) {
                            setMeetingUser(meetingUser)
                        });
                    });
                } else {
                    setMeetingUser(null);
                }
            };

            return {
                setUser: function(u) {
                    user = u;
                    trySet();
                },
                setMeeting: function(m) {
                    meeting = m;
                    trySet();
                }
            };
        })();

        sessionService.ready.then(function() {
            var initAuth = function(user) {
                meetingUserSentinel.setUser(user);
                $scope.usersInfo.setCurrentId(user.id);
                $scope.currentUser = user;
            }
            
            initAuth(sessionService.getCurrentUser())

            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });        
        });

        // load/create meeting
        var meetingPromise;
        if ($.urlParam('meet')) {
            meetingPromise = meetingService.get($.urlParam('meet'));
        } else {
            meetingPromise = meetingService.create();
        }

        meetingPromise.then(function(meeting) {
            $scope.meeting = meeting;

            meetingUserSentinel.setMeeting(meeting);

            var whereDefer = $q.defer();
            var whenDefer = $q.defer();

            // prepare formatting data
            $scope.meeting.where.$loaded(function(event) {
                formattingData.setWhere($scope.meeting.where);
                $scope.meeting.where.$watch(function(event) {
                    formattingData.setWhere($scope.meeting.where);
                });

                whereDefer.resolve();
            });

            $scope.meeting.when.$loaded(function(event) {
                formattingData.setWhen($scope.meeting.when);
                $scope.meeting.when.$watch(function(event) {
                    formattingData.setWhen($scope.meeting.when);
                });

                whenDefer.resolve();
            });

            $q.all([whereDefer.promise, whenDefer.promise]).then(function() {
                $scope.meeting.users.$ref().on('child_added', function(snap) {
                    var userId = snap.key();
                    $log.log('meeting.js: Participant added to the meeting');

                    var childRef = snap.ref();
                    var watch = {
                        where: $firebaseArray(childRef.child('where')),
                        when: $firebaseArray(childRef.child('when')),
                        group: $firebaseArray(childRef.child('group'))
                    };
                    var info = {
                        isReady: function() {
                            return this.where && this.when && this.user;
                        }
                    };

                    usersWatchList[userId] = watch;
                    $scope.usersInfo.add(userId, info);

                    var whereDefered = $q.defer();
                    var whenDefered = $q.defer();
                    var userDefered = $q.defer();

                    watch.where.$loaded(function() {
                        // format user's where data
                        info.where = formattingData.formatWhere(watch.where);

                        watch.where.$watch(function(event) {
                            if (event.event == 'child_added' || event.event == 'child_removed') {
                                info.where = formattingData.formatWhere(watch.where);
                                $scope.userGroups = buildUserGroups(formattingData);
                            }
                        });

                        whereDefered.resolve();
                    });

                    watch.when.$loaded(function() {
                        // format user's when data
                        info.when = formattingData.formatWhen(watch.when, $scope.timeFormat);

                        watch.when.$watch(function(event) {
                            if (event.event == 'child_added' || event.event == 'child_removed') {
                                info.when = formattingData.formatWhen(watch.when, $scope.timeFormat);
                                $scope.userGroups = buildUserGroups(formattingData);
                            }
                        });

                        whenDefered.resolve();
                    });

                    watch.group.$watch(function(event) {
                        $scope.userGroups = buildUserGroups(formattingData);
                    });

                    // get user's info
                    userService.get(userId).then(function(userObj) {
                        info.user = userObj;
                        userDefered.resolve();
                    });

                    // build groups after we have all data
                    $q.all([whereDefered.promise, whenDefered.promise, userDefered.promise]).then(function() {
                        $scope.$evalAsync(function() {
                            $scope.userGroups = buildUserGroups(formattingData);
                        });
                    });
                });

                $scope.meeting.users.$ref().on('child_removed', function(snap) {
                    $log.log('User removed from the meeting');
                    var userId = snap.key();
//                    usersWatchList[userId].where.$destroy();
//                    usersWatchList[userId].when.$destroy();
//                    usersWatchList[userId].group.$destroy();
                    delete usersWatchList[userId];
                    $scope.usersInfo.remove(userId);

                    $scope.$evalAsync(function() {
                        $scope.userGroups = buildUserGroups(formattingData);
                    });
                });
            });
        }, function() {
            $log.log('No such meeting');
        });
        
        function buildUserGroups(formattingData) {
            var whenMap = {};
            _.forEach(formattingData.when, function(w) {
                whenMap[w.id] = w.when;
            });

            // collection user's info for group builder
            var users = [];
            _.forOwn($scope.usersInfo.all, function(info, key) {
                // collect only fully loaded objects
                if (!info.isReady())
                    return;
                
                users.push(info);
            });
            
            var builderUsers = [];
            _.forEach(users, function(info) {
                var location = info.user.user.location || null;
                var user = {
                    userId: info.user.user.id,
                    location: location,
                    whereIds: _.pluck(_.filter(info.where, 'selected'), 'id'),
                    whenIds: _.pluck(_.filter(info.when, 'selected'), 'id')
                }
                
                builderUsers.push(user);
            });
            
            // build groups
            var groups = userGroupBuilder.build(builderUsers, whenMap);
    
            // format groups
            var result = [];
            _.forEach(groups, function(group) {

                // FIXME: commented for the testing purpose
                // we want groups with more then 1 participant
//                if (group.userIds.length < 2)
//                    return;

                var users = _.map(group.userIds, function(id) {
                    return $scope.usersInfo.all[id].user;
                });
                    
                var where = _.find(formattingData.where, function(w) {
                    return w.$id == group.where.id;
                });
                
                var when = _.find(formattingData.when, function(w) {
                    return w.id == group.when.id;
                });

                var joined = _.filter(group.userIds, function(id) {
                    var u = $scope.meeting.users.$getRecord(id);
                    return u.group
                        && u.group.where == group.where.id
                        && u.group.when == group.when.id;
                });
                
                if (where && when) {
                    result.push({
                        users: users,
                        location: group.location,
                        where: where,
                        when: {
                            when: when,
                            formatted: when.when.format($scope.timeFormat)
                        },
                        hasJoined: function(userId) {
                            return joined.indexOf(userId) >= 0;
                        }
                    });
                }
            });

            // find names that occur more than once
            var userNames = {};
            _.forOwn(users, function(info) {
                if (!userNames[info.user.user.fullName]) {
                    userNames[info.user.user.fullName] = [];
                }
                userNames[info.user.user.fullName].push(info.user.user.id);
            });
            
            var multiNames = [];
            _.forOwn(userNames, function(ids) {
                if (ids.length > 1)
                    multiNames = multiNames.concat(ids);
            });
            
            var userGroups = {
                groups: result,
                isMultiName: function(id) {
                    return multiNames.indexOf(id) >= 0;
                }
            };
            
            return userGroups;
        }
        
        $scope.joinGroup = function(group) {
            $scope.meetingUser.joinGroup(
                {
                    whereId: group.where.$id,
                    whenId: group.when.when.id
                }
            );
        };
        
        $scope.getSharingUrl = function() {
            return meetingService.getSharingUrl($scope.meeting);
        };
        
        $scope.getShareEmailSubject = function() {
            return "MEET ME HERE";
        };

        $scope.changeLocation = function() {
            // position map to current user location if we have such
            var location = null;
            var currentUser = sessionService.getCurrentUser();
            
            if (currentUser.location) {
                location = {
                    position: {
                        lat: currentUser.location.coords.lat,
                        lng: currentUser.location.coords.lng
                    },
                    radius: currentUser.location.radius
                };
            }
            
            var dialog = dialogs.locationMap(location);
            dialog.result.then(function(result) {
                if (!result)
                    return;
                
                $log.log('Change location:', result);

                geoLocation.getLocality(result.position.lat, result.position.lng).then(
                    function(location) {
                        location.radius = result.radius;
                        currentUser.updateLocation(location);
                        $log.log('geoLocation success', location);
                    }, function(error) {
                        $window.alert('Failed to change location: ' + error);
                        $log.log('geoLocation error', error);
                    }
                );
            });
        }

        var placesProvider = {
            getTerms: function() {
                return dataProvider.getTerms();
            },
            getPlaces: function(term) {
                return dataProvider.getSuggestions({
                    term: term
                });
            }
        }

        $scope.addPlaces = function() {
            var dialog = dialogs.userMeetingPlaces(placesProvider);
            
            dialog.result.then(function(places) {
                $log.log('Show places result:', places);
                _.forEach(places, function(place) {
                    
                    $scope.meeting.toggleWhere({
                        name: place.name,
                        rating_url: place.rating_url,
                        url: place.url,
                        city: place.city,
                        country_code: place.country_code
                    }, true).then(function(whereId) {
                        // select place for user
                        $scope.meetingUser.toggleWhere(whereId, true);
                    });

                });
            });
        };
        
        $scope.addPlace = function(place) {
            $scope.meetingUser.toggleWhere(place.id, true);
        }
        
        $scope.removePlace = function(place) {
            $scope.meetingUser.toggleWhere(place.id, false);
        };
        
        var timesProvider = {
            getTimes: function() {
                var formatted = formattingData.formatWhen($scope.meetingUser.when, $scope.timeFormat);
                return _.map(formatted, function(time) {
                    return time.when;
                });
            },
            format: function(time) {
                return time.format($scope.timeFormat);
            }
        };
        
        $scope.addTimes = function() {
            var dialog = dialogs.userMeetingTimes(timesProvider);
            dialog.result.then(function(times) {
                $log.log('Show times result:', times);
                // remove times
                $scope.meetingUser.removeAllWhen();
                
                // add times
                _.forEach(times, function(time) {
                    $scope.meeting.toggleWhen(time, true).then(function(whenId) {
                        // select time for user
                        $scope.meetingUser.toggleWhen(whenId, true);
                    });
                });
            });
        };
        
        $scope.addTime = function(place) {
            $scope.meetingUser.toggleWhen(place.id, true);
        }
        
        $scope.removeTime = function(time) {
            $scope.meetingUser.toggleWhen(time.id, false);
        }
        
        $scope.showUserInfo = function(userInfo) {
            dialogs.meetingUserInfo(userInfo);
        }
        $scope.getMeetingLocation = function(location) {
            if (location.city) {
                return '(' +  location.city + ')';
            } else if (location.country_code) {
                return '(' +  location.country_code + ')';
            }
            
            return '';
        }
    }]);
})();
