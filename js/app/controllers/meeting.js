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
    
    app.controller('meetingController', ['$scope', '$q', '$log', '$firebaseArray', 'dialogs', 'dataProvider', 'meetingService', 'userService', 'geoLocation', 'userGroupBuilder','$window',
            function($scope, $q, $log, $firebaseArray, dialogs, dataProvider, meetingService, userService, geoLocation, userGroupBuilder, $window) {

                // get from the session
        var currentUser = {
            id: '-JtnL-ITrHRaScQVjGeN'
        };

        $scope.timeFormat = 'h:mmA';
        $scope.meetingId = null;
        if ($.urlParam('meet')) {
            $scope.meetingId = $.urlParam('meet');
        } else {
            $scope.meetingId = meetingService.create(currentUser.id);
        }
        
        $scope.meeting = null;
        $scope.meetingUser = null;
        $scope.meetingWhere = [];
        $scope.meetingWhen = [];
        
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
        var usersInfo = {};                 // formatted date
        var usersWatchList = {};            // watches
        
        $scope.currentUserInfo = null;
        $scope.otherUsersInfo = null;
        $scope.userGroups = null;
        

        // load meeting info
        meetingService.get($scope.meetingId).then(function(meeting) {
            $scope.meeting = meeting;

            meeting.getUser(currentUser.id).then(function(user) {
                $scope.meetingUser = user;

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
                        $log.log('User added to the meeting');

                        var childRef = snap.ref();
                        var watch = {
                            where: $firebaseArray(childRef.child('where')),
                            when: $firebaseArray(childRef.child('when')),
                            group: $firebaseArray(childRef.child('group'))
                        };
                        var info = {};

                        usersWatchList[userId] = watch;
                        usersInfo[userId] = info;

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
                            usersInfo[userId].user = userObj;
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
                        usersWatchList[userId].where.$destroy();
                        usersWatchList[userId].when.$destroy();
                        usersWatchList[userId].group.$destroy();
                        delete usersWatchList[userId];
                        delete usersInfo[userId];
                        
                        $scope.$evalAsync(function() {
                            $scope.userGroups = buildUserGroups(formattingData);
                        });
                    });

                    $scope.currentUserInfo = getCurrentUserInfo();
                    $scope.otherUsersInfo = getOtherUsersInfo();
                });
            }, function() {
                $log.log('No such user');
            });
        }, function() {
            $log.log('No such meeting');
        });
        
        function getCurrentUserInfo() {
            return usersInfo[currentUser.id];
        }
        
        function getOtherUsersInfo() {
            return _.values(_.omit(usersInfo, currentUser.id));
        }

        
        function buildUserGroups(formattingData) {
            var whenMap = {};
            _.forEach(formattingData.when, function(w) {
                whenMap[w.id] = w.when;
            });
            
            var users = _.filter(_.values(usersInfo), function(user) {
                return user.where && user.when && user.user;        // only loaded objects
            });

            // build groups
            var groups = userGroupBuilder.build(
                _.map(users, function(userInfo) {
                    var location = userInfo.user.user.location || null;
                    return {
                        userId: userInfo.user.user.id,
                        location: location,
                        whereIds: _.pluck(userInfo.where, 'id'),
                        whenIds: _.pluck(userInfo.when, 'id')
                    }
                }),
                whenMap
            );
    
            // format groups
            var result = [];
            _.forEach(groups, function(group) {

                // we want groups with more then 1 participant
//                if (group.userIds.length < 2)
//                    return;

                var users = _.map(group.userIds, function(id) {
                    return usersInfo[id].user;
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
            _.forOwn(users, function(u) {
                if (!userNames[u.user.name]) {
                    userNames[u.user.name] = [];
                }
                userNames[u.user.name].push(u.user.id);
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
        }
        
        $scope.getSharingUrl = function() {
            return meetingService.getSharingUrl($scope.meeting);
        }

        $scope.changeLocation = function() {
            // position map to current user location if we have such
            var location = null;
            currentUser.location = $scope.currentUserInfo.user.getLocation();
            
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
                        $scope.currentUserInfo.user.updateLocation(location);
//                        userService.updateLocation(currentUser.id, location);
//                        $log.log('geoLocation success', location);
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
                        url: place.url
                    }, true).then(function(whereId) {
                        // select place for user
                        $scope.meetingUser.toggleWhere(whereId, true);
                    });

                });
            });
        };
        
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
        
        $scope.removeTime = function(time) {
            $scope.meetingUser.toggleWhen(time.id, false);
        }
        
        $scope.showUserInfo = function(userInfo) {
            dialogs.meetingUserInfo(userInfo);
        }
    }]);
})();


