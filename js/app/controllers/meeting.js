;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    
    app.controller('meetingController', ['$scope', '$q', '$log', '$firebaseObject', '$firebaseArray', 'dialogs', 'dataProvider', 'sessionService', 'meetingService', 'userService', 'geoLocation', 'userGroupBuilder','$window', 'util', 'notificationService', 'emailService','localMeetingService', 'categoryService','historyService','commentService',
            function($scope, $q, $log, $firebaseObject, $firebaseArray, dialogs, dataProvider, sessionService, meetingService, userService, geoLocation, userGroupBuilder, $window, util, notificationService, emailService, localMeetingService, categoryService, historyService, commentService) {

        // get from the session
        $scope.timeFormat = 'h:mmA';
        $scope.meeting = null;
        $scope.meetingUser = null;
        $scope.userGroups = null;
        $scope.currentUser = null;
        $scope.currentPage = util.getCurrentPage();
        $scope.currentMeetingId = util.getUrlParams('act');
        $scope.changingGroups = false;
        $scope.ended = false;
        $scope.comments = {};
        $scope.numberOfCommentToShow = 2;
        $scope.commentedUsers = [];
        $scope.newComment = null;
        $scope.groupTimeout = null;
        $scope.categoryIconClass = '';
        $scope.unsubscribeList = [];
        $scope.rsvpAfterLogin = false;
        $scope.groupToRSVP = null;
        $scope.browserPosition = null;
        
        if (document.referrer == '' || (!document.referrer.indexOf('socialivo.com') == -1 && !document.referrer.indexOf('mmh.app') == -1 && !document.referrer.indexOf('localhost') == -1)) {
            $window.location = meetingService.getSharingUrl($scope.currentMeetingId);
        }
        $window.$('.loading-wrap').show();
        
        emailService.getUnsubscribeList($scope.currentMeetingId).then(function(unsubscribeList) {
            $scope.unsubscribeList = unsubscribeList;
        });
        
        var getCurrentLocation = function () {
            var browserLocation = geoLocation.getPosition();
            browserLocation.then(function(position) {
                $scope.browserPosition = position.coords;
            });
        };
        
        getCurrentLocation();
        
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
                        fullInfoFormatted: when.when.format('dddd MMMM, Do h:mmA'),
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
                    //this.current = null;
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
            },
            updateWhere: function(formattingData, userId) {
                var users = userId ? [{ userId: this.all[userId] }] : this.all;
                _.forEach(this.all, function(info, id) {
                    var watch = usersWatchList[id];
                    info.where = formattingData.formatWhere(watch.where);
                });
            },
            updateWhen: function(formattingData, userId) {
                var users = userId ? [{ userId: this.all[userId] }] : this.all;
                _.forEach(this.all, function(info, id) {
                    var watch = usersWatchList[id];
                    info.when = formattingData.formatWhen(watch.when, $scope.timeFormat);
                });
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
                    // sendNewUserJoinedNotification(user, meeting);
                    meeting.addUser(user.id).then(function() {
                        meeting.getUser(user.id).then(function(meetingUser) {
                            setMeetingUser(meetingUser);
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
                $scope.currentUser = user;
                userService.get(user.id).then(function(userObj) {
                    userObj.meetingList.$loaded().then(function(data) {
                        userObj.removePassedActivities();
                        userObj.removeUnusedActivities(user.id);
                        $scope.meetingList = data;
                    });
                });
            };
            
            initAuth(sessionService.getCurrentUser());
            
            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user, state) {         
                // redirect if state == auth -> anonymous
                meetingUserSentinel.setUser(user);
                $scope.usersInfo.setCurrentId(user.id);
                
                initAuth(user);
                
                if (state == sessionService.states.LOGOUT) {
                    $scope.usersInfo.current.user = user;
                }
                
                $scope.userGroups = buildUserGroups(formattingData);
                
                $scope.addMeetingToUser();
                
                if ($scope.rsvpAfterLogin && $scope.groupToRSVP) {
                    $scope.joinGroup($scope.groupToRSVP);
                    $scope.rsvpAfterLogin = false;
                    $scope.groupToRSVP = null;
                }
            });        
        });
        
        $scope.addMeetingToUser = function(expireTime){
            
            if (!expireTime) {
                expireTime = meetingService.getExpireTime(angular.copy($scope.meeting.when));
            }
            
            // add meeting to user if not added yet
            var meetingData = {
                id: $scope.meeting.id,
                name: $scope.meeting.name,
                createdDate: $scope.meeting.timeTitle || moment().utc().toISOString(),
                timeTitle: $scope.meeting.timeTitle || '',
                expireTime: expireTime
            };
            userService.addMeetingToUser($scope.currentUser.id, meetingData).then(function(){
//                console.log('Activity ' + meetingData.id + ' added to User: ' + $scope.currentUser.id);
            }, function(error){
                console.log('Can not add activity to User. Error: ' + error);
            });
        }
        
        var sendNewUserJoinedNotification = function(user, meeting) {
            var userIds = Object.keys(meeting.users).map(function(value) {
                return meeting.users[value].$id;
            }); 
            userIds = userIds.filter(function(value) {return value;});
            
            var currentUserId = user.id;
            
            if (userIds.indexOf(currentUserId) !== -1) {
                return false;
            }
            
            var notificationData = {
                type: 'user',
                status: '1',
                value: user.user.fullName || 'Anonymous',
                createdAt: moment().utc().toISOString(),
                meetId: meeting.id,
                meetName: meeting.name
            };

            for (var i in userIds) {
                notificationService.addNotificationToUser(userIds[i], notificationData);
            }
            
        }

        // load/create meeting
        var meetingPromise;
        if (util.getUrlParams('act')) {
            meetingPromise = meetingService.get(util.getUrlParams('act'));
        } else {
            $window.location = '/index.html';
        }

        if (util.getUrlParams('share')) {
            $scope.share = util.getUrlParams('share');
        } else {
            $scope.share = 0;
        }

        meetingPromise.then(function(meeting) {
            $scope.meeting = meeting;
            $scope.categoryIconClass = $scope.meeting.category ? $scope.meeting.category : '';
            $window.$('.title-page').show();
            $window.$('.loading-wrap').hide();
            
            sessionService.setMeetingId($scope.meeting.id);

            if (!util.getUrlParams('act')) {
                $window.location = $window.location.href + '?act=' + meeting.id;
            }
            meetingUserSentinel.setMeeting(meeting);

            
            
            var whereDefer = $q.defer();
            var whenDefer = $q.defer();

            // prepare formatting data
            $scope.meeting.where.$loaded(function(event) {
                formattingData.setWhere($scope.meeting.where);
                $scope.meeting.where.$watch(function(event) {
                    formattingData.setWhere($scope.meeting.where);
                    $scope.usersInfo.updateWhere(formattingData);
                });

                whereDefer.resolve();
            });

            $scope.meeting.when.$loaded(function(event) {
                formattingData.setWhen($scope.meeting.when);
                $scope.meeting.when.$watch(function(event) {
                    formattingData.setWhen($scope.meeting.when);
                    $scope.usersInfo.updateWhen(formattingData);
                });

                whenDefer.resolve();
            });

            $q.all([whereDefer.promise, whenDefer.promise]).then(function() {
                $scope.meeting.users.$ref().on('child_added', function(snap) {
                    var userId = snap.key();

                    var childRef = snap.ref();
                    var watch = {
                        where: $firebaseArray(childRef.child('where')),
                        when: $firebaseArray(childRef.child('when')),
                        group: $firebaseObject(childRef.child('group'))
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
                        $scope.usersInfo.updateWhere(formattingData, userId);

                        watch.where.$watch(function(event) {
                            if (event.event == 'child_added' || event.event == 'child_removed') {
                                $scope.usersInfo.updateWhere(formattingData, userId);
                                var oldUserGroups = $scope.userGroups;
                                $scope.userGroups = buildUserGroups(formattingData);
                                if (event.event == 'child_added') {
                                    addGroupNotification(oldUserGroups, $scope.userGroups);
                                }
                            }
                        });

                        whereDefered.resolve();
                    });

                    watch.when.$loaded(function() {
                        // format user's when data
                        $scope.usersInfo.updateWhen(formattingData, userId);

                        watch.when.$watch(function(event) {
                            if (event.event == 'child_added' || event.event == 'child_removed') {
                                $scope.usersInfo.updateWhen(formattingData, userId);
                                var oldUserGroups = $scope.userGroups;
                                $scope.userGroups = buildUserGroups(formattingData);
                                if (event.event == 'child_added') {
                                    addGroupNotification(oldUserGroups, $scope.userGroups);
                                }     
                            }
                        });

                        whenDefered.resolve();
                    });

                    watch.group.$watch(function(event) {
                        if (watch.group.where && watch.group.when) {
                            info.group = {
                                where: watch.group.where,
                                when: watch.group.when
                            };
                        } else {
                            info.group = null;
                        }
                        
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
                
                var finished = checkIfFinished(angular.copy($scope.meeting.when));
                
                if (finished) {
                     $scope.ended = true;
                
                    $scope.addPlaces = false;
                    $scope.togglePlace = false;
                    $scope.addTimes = false;
                    $scope.toggleTime = false;
                    $scope.joinGroup = false;
                    $scope.changeLocation = false;
                }
                
                if (util.getUrlParams('addTime') && !$scope.ended) {
                    sessionService.ready.then(function() {
                        $scope.addTimes();
                    });
                }
                
                if (util.getUrlParams('addPlace') && !$scope.ended) {
                    sessionService.ready.then(function() {
                        $scope.addPlaces();
                    });
                }
                
                if (util.getUrlParams('rsvp') && !$scope.ended) {
                    sessionService.ready.then(function() {
                        $scope.usersInfo.setCurrentId($scope.currentUser.id);
                        meeting.addUser($scope.currentUser.id).then(function() {
                            meeting.getUser($scope.currentUser.id).then(function(meetingUser) {
                                $scope.meetingUser = meetingUser;
                                
                                if ($scope.usersInfo.current.where[0] && !$scope.usersInfo.current.where[0].selected) {
                                    $scope.togglePlace($scope.usersInfo.current.where[0]);
                                }
                                
                                var selectedTimeIndex = 0;
                                if (util.getUrlParams('selectedTime')) {
                                    for (var key in $scope.usersInfo.current.when) {
                                        if (util.getUrlParams('selectedTime') == $scope.usersInfo.current.when[key].id) {
                                            selectedTimeIndex = key;
                                            break;
                                        }
                                    }
                                }
                                
                                if ($scope.usersInfo.current.when[selectedTimeIndex] && !$scope.usersInfo.current.when[selectedTimeIndex].selected) {
                                    $scope.toggleTime($scope.usersInfo.current.when[selectedTimeIndex]);
                                }
                                
                                setTimeout(function(){
                                    $scope.userGroups = buildUserGroups(formattingData);
                                    if ($scope.userGroups.groups && $scope.userGroups.groups[0] && 
                                            !$scope.userGroups.groups[0].hasJoined($scope.currentUser.id)) {
                                        $scope.joinGroup($scope.userGroups.groups[0]);
                                        
                                        if ($window.$('.fake-group').is(":visible")) {
                                            $window.$('.fake-group').hide();
                                        }
                                    }
                                }, 500);
                            });
                        });
                    });
                }
            });
            
            activateFacebookSDK();
            
        }, function() {
            $window.$('.loading-wrap').hide();
            $window.location = '/index.html';
        });
        
        var checkIfFinished = function (times) {
            var finished = true;
            _.forEach(times, function(time) {
                if (moment().diff(moment(time.$value)) < 2 * 3600 * 1000) {
                    finished = false;
                }
            });
            return finished;
        };
        
        function buildUserGroups(formattingData) {
            if (!$scope.currentUser) {
                clearTimeout($scope.groupTimeout);
                $scope.groupTimeout = setTimeout(function() {
                    $scope.userGroups = buildUserGroups(formattingData);
                }, 50);
                return [];
            }
            
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
                var user = {
                    userId: info.user.user.id,
                    group: info.group,
                    whereIds: _.pluck(_.filter(info.where, 'selected'), 'id'),
                    whenIds: _.pluck(_.filter(info.when, 'selected'), 'id')
                }
                
                builderUsers.push(user);
            });
            
            // build groups
//            var groups = userGroupBuilder.build(builderUsers, whenMap, $scope.currentUser);
            
            var allPlaces = _.map(formattingData.where, function(where){return where.$id});
            var allTimes = _.map(formattingData.when, function(when){return when.id});
            var groups = userGroupBuilder.build(allPlaces, allTimes, builderUsers, $scope.currentUser);

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
                isMultiName: function(userId) {
                    return multiNames.indexOf(userId);
                }
            };
            
            return userGroups;
        }
             
        $scope.joinGroup = function(group) {
            if ($scope.currentUser.isAnonymous()) {
                alert('Please Login to RSVP');
                dialogs.auth();
                $scope.rsvpAfterLogin = true;
                $scope.groupToRSVP = group;
                return;
            }
            
            if ($.cookie('local_event_' + $scope.currentUser.id)) {
                $.removeCookie('local_event_' + $scope.currentUser.id);
            }
            
            if ($scope.meetingUser.userId !== $scope.currentUser.id) {
                setTimeout(function(){
                    $scope.joinGroup(group);
                }, 1000);
                return;
            }
            
            if (!group.hasJoined($scope.currentUser.id)) {
                addRSVPNotification(group);
                
                // add data to history
                var historyData = {
                    id: $scope.meeting.id,
                    name: $scope.meeting.name,
                    timeTitle: angular.copy(group.when.when.when).utc().toISOString(),
                    time: angular.copy(group.when.when.when).utc().toISOString(),
                    place: {
                        name: group.where.name || '',
                        display_address: group.where.location.display_address || '',  
                        city: group.where.city || '',  
                        country_code: group.where.country_code || '',  
                        type: group.where.type || '',
                        image_url: group.where.image_url || '',
                        categories: group.where.categories || []
                    },
                    whereId: group.where.$id,
                    whenId: group.when.when.id
                };
                historyService.addHistoryToUser($scope.currentUser.id, $scope.meeting.id, historyData);
                
                util.addEventToDataLayer('Activity', 'Interaction', 'RSVP', null);
            }           
            $scope.meetingUser.joinGroup(
                {
                    whereId: group.where.$id,
                    whenId: group.when.when.id
                }
            );
        };
        
        $scope.needsGroupUserDetails = function(userGroups, user) {
            if (!$scope.currentUser)
                return false;

            return user.id == $scope.currentUser.id
                && (userGroups.isMultiName(user.id) || user.isAnonymous());
        }

        $scope.getSharingUrl = function(shouldEncode) {
            if (!$scope.meeting) {
                return '';
            }
            if (shouldEncode) {
                return encodeURIComponent(meetingService.getSharingUrl($scope.meeting.id));
            }
            return meetingService.getSharingUrl($scope.meeting.id);
        };
        
        $scope.getFacebookSharingUrl = function() {    
            if (!$scope.meeting) {
                return '';
            }
            return meetingService.getFacebookSharingUrl($scope.meeting.id, $scope.getShareMeetingName($scope.meeting));
        };
        
        $scope.getShareEmailSubject = function() {
            return $scope.getShareMeetingName($scope.meeting);
        };
        $scope.getShareEmailBody = function() {
            return "Click the link to view activity details: \r\n" + meetingService.getSharingUrl($scope.meeting.id);
        };

        $scope.changeLocation = function() {
            // position map to current user location if we have such
            var location = null;
            var currentUser = sessionService.getCurrentUser();
            
            if (currentUser.user.location) {
                location = {
                    position: currentUser.user.location.coords,
                    radius: currentUser.user.location.radius
                };
            }
            
            var dialog = dialogs.locationMap(location);
            dialog.result.then(function(result) {
                if (!result)
                    return;
                
                geoLocation.getLocality(result.position.lat, result.position.lng).then(
                    function(locality) {
                        location = {
                            coords: locality.coords,
                            radius: result.radius,
                            shortName: locality.shortName
                        };
                        currentUser.updateLocation(location);
                    }, function(error) {
                        $window.alert('Failed to change location: ' + error);
                        $log.log('geoLocation error', error);
                    }
                );
            });
        }

        var placesProvider = {
            getTerms: function() {
                return dataProvider.getActivities();
            },
            getPlaces: function(term, sort) {
                var options = {term: term, sort: sort};
                options = $scope.getMeetingLocationOptions(options);
                return dataProvider.getSuggestions(options);
            },
            getCategory: function() {
                return $scope.meeting.category || '';
            },
            getMeetingOptions: function() {
                return $scope.getMeetingLocationOptions({});
            },
            getDistanceUnit: function() {
                return $scope.currentUser.user.distance_unit || 'foot';
            }
        }

        $scope.getMeetingLocationOptions = function(options) {
            options.limit = 10;
            
            if ($scope.meeting.specificLocation) {
                options.location = $scope.meeting.specificLocation;
            } else if ($scope.meeting.meetMeHere && $scope.browserPosition) {
                options.coords = {lat: $scope.browserPosition.latitude, lng: $scope.browserPosition.longitude};
            } else if ($scope.currentUser.user.location) {
                options.coords = $scope.currentUser.user.location.coords;
                options.radius = util.convertMilesToKms($scope.currentUser.user.location.radius);
            }
            return options;
        }
        
        $scope.addPlaces = function() {
            var dialog = dialogs.userMeetingPlaces(placesProvider);
            
            dialog.result.then(function(places) {
                addPlaceNotification(angular.copy($scope.meeting.where), places);
                _.forEach(places, function(place) {

                    $scope.meeting.toggleWhere(place, true).then(function(whereId) {
                        // select place for user
                        $scope.meetingUser.toggleWhere(whereId, true);
                    });

                });
                
                $scope.addMeetingToUser();
            });
        };
        
        $scope.togglePlace = function(place) {
            if (place.selected) {
                $scope.meetingUser.toggleWhere(place.id, false);
                
                util.addEventToDataLayer('Activity', 'Interaction', 'Unselect Venue', place.name);
            } else {
                $scope.meetingUser.toggleWhere(place.id, true);
                $scope.addMeetingToUser();
                
                util.addEventToDataLayer('Activity', 'Interaction', 'Select Venue', place.name);
            }
            $scope.changingGroups = true;
        };
        
        
        var timesProvider = {
            getTimes: function() {
                return [];
                var formatted = formattingData.formatWhen($scope.meetingUser.when, $scope.timeFormat);
                return _.map(formatted, function(time) {
                    return time.when;
                });
            },
            format: function(time) {
                return time.format($scope.timeFormat);
            }
        };
        
        var getNewGroupAdded = function (oldGroups, newGroups) {
            for (var i in newGroups.groups) {
                var currentGroup = newGroups.groups[i];
                var isNew = true;
                for (var j in oldGroups.groups) {
                    if (currentGroup.when.formatted == oldGroups.groups[j].when.formatted
                        && currentGroup.where.name == oldGroups.groups[j].where.name) {
                        isNew = false;
                    }
                }
                
                if (isNew) {
                    return currentGroup;
                }
            }
            
            return false;
        };
        
        var getNewPlaceAdded = function (oldPlaces, newPlaces) {
            var existingPlaces = Object.keys(oldPlaces).map(function(value){return oldPlaces[value].name;});
            for (var i in newPlaces) {
                var place = newPlaces[i].name;
                if (existingPlaces.indexOf(place) === -1) {
                    return place;
                }
            }
            return false;
        };
        
        var getNewTimeAdded = function (oldTimes, newTimes) {
            var existingTimes = Object.keys(oldTimes).map(function(value){return oldTimes[value].$value;});
            for (var i in newTimes) {
                var time = newTimes[i].clone().utc().toISOString();
                if (existingTimes.indexOf(time) === -1) {
                    return time;
                }
            }
            return false;
        };
        
        var addTimeNotification = function (oldTimes, newTimes) {
            var newTimeAdded = getNewTimeAdded(oldTimes, newTimes);
            if (newTimeAdded) {
                $scope.changingGroups = true;
                var notificationData = {
                    type: 'time',
                    status: '1',
                    value: newTimeAdded,
                    createdAt: moment().utc().toISOString(),
                    meetId: $scope.meeting.id,
                    meetName: $scope.meeting.name
                };
                
                var sendingEmails = [];
                
                for (var i in $scope.usersInfo.others) {
                    if (typeof $scope.usersInfo.others[i] === 'object') {
                        // onsite notification - temporary disable
                        //notificationService.addNotificationToUser($scope.usersInfo.others[i].user.id, notificationData);
                        
                        if (
                                $scope.usersInfo.others[i].user.user.email && 
                                !$scope.usersInfo.others[i].user.user.disableEmailNoti &&
                                $scope.unsubscribeList.indexOf($scope.usersInfo.others[i].user.user.email) === -1
                            ) {
                            sendingEmails.push($scope.usersInfo.others[i].user.user.email); 
                        }
                    }
                }
                
                // email notification - temporary disable
                if (sendingEmails.length > 0) {
                    //emailService.sendEmailToUsers(sendingEmails, notificationData);
                }
                
                util.addEventToDataLayer('Activity', 'Time', 'Add', newTimeAdded);
            }
        };
        
        var addRSVPNotification = function (group) {

                var time = angular.copy(group.when.when.when);
                var profileImageUrl = $scope.currentUser.user.profileImageURL || ''
                var notificationData = {
                    type: 'rsvp',
                    status: '1',
                    value: $scope.currentUser.user.fullName,
                    place: group.where.name,
                    time: time.utc().toISOString(),
                    createdAt: moment().utc().toISOString(),
                    meetId: $scope.meeting.id,
                    meetName: $scope.meeting.name,
                    image: profileImageUrl.replace('http:', 'https:')
                };
                
                var sendingEmails = [];
                var resgistrationIds = [];
                
                for (var i in $scope.usersInfo.others) {
                    if (typeof $scope.usersInfo.others[i] === 'object') {
                        // onsite notification - temporary disable
                        notificationService.addNotificationToUser($scope.usersInfo.others[i].user.id, notificationData);
                        
                        if (
                                $scope.usersInfo.others[i].user.user.email && 
                                !$scope.usersInfo.others[i].user.user.disableEmailNoti &&
                                $scope.unsubscribeList.indexOf($scope.usersInfo.others[i].user.user.email) === -1
                            ) {
                            sendingEmails.push($scope.usersInfo.others[i].user.user.email);
                            
                        }
                        if ($scope.usersInfo.others[i].user.user.registrationId) {
                            resgistrationIds.push($scope.usersInfo.others[i].user.user.registrationId);
                        }
                    }
                }
                
                // email notification - temporary disable
                if (sendingEmails.length > 0) {
                    emailService.sendEmailToUsers(sendingEmails, notificationData);
                }
                
                if (resgistrationIds.length > 0) {
                    emailService.sendPushNotification(resgistrationIds);
                }
        };
        
        var addPlaceNotification = function (oldPlaces, newPlaces) {
            var newPlaceAdded = getNewPlaceAdded(oldPlaces, newPlaces);
            if (newPlaceAdded) {
                $scope.changingGroups = true;
                var notificationData = {
                    type: 'place',
                    status: '1',
                    value: newPlaceAdded,
                    createdAt: moment().utc().toISOString(),
                    meetId: $scope.meeting.id,
                    meetName: $scope.meeting.name
                };
                
                var sendingEmails = [];
                
                for (var i in $scope.usersInfo.others) {
                    if (typeof $scope.usersInfo.others[i] === 'object') {
                        // onsite notification - temporary disable
                        //notificationService.addNotificationToUser($scope.usersInfo.others[i].user.id, notificationData);
                        
                        if (
                                $scope.usersInfo.others[i].user.user.email && 
                                !$scope.usersInfo.others[i].user.user.disableEmailNoti &&
                                $scope.unsubscribeList.indexOf($scope.usersInfo.others[i].user.user.email) === -1
                            ) {
                            sendingEmails.push($scope.usersInfo.others[i].user.user.email);
                            
                        }
                    }
                }
                
                // email notification - temporary disable
                if (sendingEmails.length > 0) {
                    //emailService.sendEmailToUsers(sendingEmails, notificationData);
                }
                
                util.addEventToDataLayer('Activity', 'Venue', 'Add', newPlaceAdded);
            }
        };
        
        var addGroupNotification = function (oldGroups, newGroups) {
            if (!$scope.changingGroups) {
                return false;
            }
            var newGroupAdded = getNewGroupAdded(oldGroups, newGroups);
            if (newGroupAdded) {
                var notificationData = {
                    type: 'group',
                    status: '1',
                    time: newGroupAdded.when.when.when.toISOString(),
                    place: newGroupAdded.where.name,
                    value: newGroupAdded.where.name + ' @ ' + newGroupAdded.when.formatted,
                    createdAt: moment().utc().toISOString(),
                    meetId: $scope.meeting.id,
                    meetName: $scope.meeting.name,
                    image: newGroupAdded.where.image_url.replace('http:','https:')
                };
                
                var groupId = newGroupAdded.when.when.id + '-' + newGroupAdded.where.$id;
                
                var groupObject = meetingService.checkGroupExisted($scope.meeting.id, groupId);
                
                groupObject.$loaded(function(snapshot) {
                    if (snapshot.$value === null) {
                        groupObject.createdAt = moment().toISOString();
                        groupObject.$save();
                        
                        var sendingEmails = [];
                        var resgistrationIds = [];
                        for (var i in $scope.usersInfo.others) {
                            if (typeof $scope.usersInfo.others[i] === 'object') {
                                // onsite notification
                                notificationService.addNotificationToUser($scope.usersInfo.others[i].user.id, notificationData);
                                if (
                                        $scope.usersInfo.others[i].user.user.email && 
                                        !$scope.usersInfo.others[i].user.user.disableEmailNoti &&
                                        $scope.unsubscribeList.indexOf($scope.usersInfo.others[i].user.user.email) === -1
                                    ) {
                                    sendingEmails.push($scope.usersInfo.others[i].user.user.email);
                                }
                                if ($scope.usersInfo.others[i].user.user.registrationId) {
                                    resgistrationIds.push($scope.usersInfo.others[i].user.user.registrationId);
                                }
                            }
                        }

                        // email notification
                        if (sendingEmails.length > 0) {
                            emailService.sendEmailToUsers(sendingEmails, notificationData);
                        }
                        
                        if (resgistrationIds.length > 0) {
                            emailService.sendPushNotification(resgistrationIds);
                        }
                    }
                });
                
                
            }
            $scope.changingGroups = false;
        };
        
        $scope.addTimes = function() {
            var dialog = dialogs.userMeetingTimes(timesProvider);
            dialog.result.then(function(times) {
                addTimeNotification(angular.copy($scope.meeting.when), times);
                // remove times
//                $scope.meetingUser.removeAllWhen();
                
                // add times
                _.forEach(times, function(time) {
                    $scope.meeting.toggleWhen(time, true).then(function(whenId) {
                        // select time for user
                        $scope.meetingUser.toggleWhen(whenId, true);
                    });
                });
                
                var expireTime = meetingService.getExpireTime(angular.copy(times));
                categoryService.updateExpireTime($scope.meeting.category, $scope.meeting.id, expireTime);
                
                $scope.addMeetingToUser(expireTime);
            });
        };
        
        $scope.toggleTime = function (time) {
            if (time.selected) {
                $scope.meetingUser.toggleWhen(time.id, false);
                
                util.addEventToDataLayer('Activity', 'Interaction', 'Unselect Time', time.whenFormatted);
                $scope.changingGroups = true;
            } else if (moment().diff(time.when) <= 2 * 3600 * 1000) {
                $scope.meetingUser.toggleWhen(time.id, true);
                $scope.addMeetingToUser();
                
                util.addEventToDataLayer('Activity', 'Interaction', 'Select Time', time.whenFormatted);
                $scope.changingGroups = true;
            } else if (confirm("This time has already passed. Are you sure you want to select it?")){
                $scope.meetingUser.toggleWhen(time.id, true);
                $scope.addMeetingToUser();
                
                util.addEventToDataLayer('Activity', 'Interaction', 'Select Time', time.whenFormatted);
                $scope.changingGroups = true;
            } else {
                $scope.addTimes();
            }
            
        };
        
        $scope.addTime = function($event, place) {
            $event.stopPropagation();
            $scope.meetingUser.toggleWhen(place.id, true);
        }
        
        $scope.removeTime = function(time) {
            $scope.meetingUser.toggleWhen(time.id, false);
        }
        
        $scope.getMeetingLocation = function(location) {
            if (location.city) {
                return '(' +  location.city + ')';
            } else if (location.country_code) {
                return '(' +  location.country_code + ')';
            }
            
            return '';
        };
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.getShareMeetingName = function (meeting) {
            if (!meeting || !meeting.users || !$scope.currentUser || !$scope.currentUser.user) {
                return '';
            }
            var title = meeting.name || '',
                whenId = '',
                whereId = '',
                time = '',
                place = '';
            
            
            // get correct time and place
            _.forEach (meeting.users, function(user) {
                if (user.$id === $scope.currentUser.user.$id) {
                    if (user.group) {
                        whenId = user.group.when;
                        whereId = user.group.where;
                    } else {
                        if (user.when) {
                            whenId = user.when[Object.keys(user.when)[0]];
                        }
                        if (user.where) {
                            whereId = user.where[Object.keys(user.where)[0]];
                        }
                    }
                    
                }
            });
            
            // get default time/place if not chosen anything
            if (whenId) {
                _.forEach(meeting.when, function(meetingTime) {
                    if (meetingTime.$id === whenId) {
                        time = meetingTime.$value;
                    }
                })
            } else if (meeting.when && meeting.when[0]){
                time = meeting.when[0].$value;
            }
            
            if (whereId) {
                _.forEach(meeting.where, function(meetingPlace) {
                    if (meetingPlace.$id === whereId) {
                        place = meetingPlace.name;
                    }
                })
            } else if (meeting.where && meeting.where[0]) {
                place = meeting.where[0].name;
            }
            
            var metadata = '';
            if (place && time) {
                metadata = ' (' + place + ' @ ' +  moment(time).format('h:mmA') + ')';
            } else if (place) {
                metadata = ' (' + place + ')';
            } else if (time) {
                metadata = ' ('  +  moment(time).format('h:mmA') + ')';
            }
            
            var result = title + metadata;     
            result = result.replace('&', 'and');
            
            return result;
        }
        
        $scope.copy = function() {
            document.getElementById("sharing_url").style.display = 'block';
            document.getElementById("sharing_url").select();
            document.execCommand('copy');
            document.getElementById("sharing_url").style.display = 'none';
            alert($scope.getSharingUrl() + '\n copied to clipboard');
        }
        
        $scope.startTutorial = function() {
            util.addEventToDataLayer('Tutorial', 'Start', 'Activity', null);
            
            if (sessionService.getViewedTutorialStatus(1) || sessionService.getViewedTutorialStatus(2)) {
                // if viewed homepage or index page, remove common tutorial
                $window.$('.common-tooltip').remove();
            }
            
            if (!sessionService.getViewedTutorialStatus() || !$scope.userGroups.groups.length) {
                $window.$('.fake-group').show();
                $window.$('.no-group').hide();
            }
            
            $window.$('#joyRideTipContent').joyride({
                autoStart: true,
                postStepCallback: function (index, tip) {
                },
                postRideCallback: function() {
                    if (!sessionService.getViewedTutorialStatus() || !$scope.userGroups.groups.length) {
                        $window.$('.fake-group').hide();
                        $window.$('.no-group').show();
                    }
                    util.addEventToDataLayer('Tutorial', 'Cancel', 'Activity', null);
                },
                modal: true,
                expose: true
            });
        }
        
        
        $scope.createFromTemplate = function () {
            var times   = getTimeFromTemplate();
            var places  = getPlaceFromTemplate();
            var users = {};
            if ($scope.currentUser && $scope.currentUser.id) {
                users[$scope.currentUser.id] = {
                    joined: true,
                    where: util.getFirebaseKeys(places),
                    when: util.getFirebaseKeys(times),
                    creator: true
                };
            }
            var timeTitle = times[Object.keys(times)[0]] || changeDateToToday($scope.meeting.timeTitle);
            var data = {
                name: $scope.meeting.name,
                createdDate: moment().utc().toISOString(),
                when: times,
                where: places,
                users: users,
                timeTitle: timeTitle,
                specific_location: $scope.meeting.specific_location || '',
                category: $scope.meeting.category || 'Other'
            };

            $window.$('.loading-wrap').show();
            var meetingPromise = meetingService.create(data);
            meetingPromise.then(function(meeting) {
                var meetingId = meeting.refs.current.key();
                if (data.where.length > 0) {
                    // add place to the local Events
                    localMeetingService.add(meetingId, '0', data.where[0].location.coordinate, data.timeTitle).then(function() {
                        if ($.cookie('local_event_' + $scope.currentUser.id)) {
                            $.removeCookie('local_event_' + $scope.currentUser.id);
                        }
                    });
                }

                data.meetingId = meetingId;
                $scope.redirectUrl = 'activity.html?act=' + meetingId;

                addMeetingToCategory(data);
                $window.$('.loading-wrap').hide();
                
                setTimeout(function() {
                    $window.location.href = $scope.redirectUrl;
                }, 500);
            });
        };
        

        var addMeetingToCategory = function(data) {
            var categoryId = data.category;
            
            var meetingData = {
                id: data.meetingId,
                name: data.name,
                createdDate: data.createdDate,
                timeTitle: data.timeTitle
            } ;
            categoryService.addMeetingToCategory(categoryId, categoryId, meetingData);
        }
        
        var getTimeFromTemplate = function () {
            var result  = {};
            var times   = angular.copy($scope.meeting.when);
            var minTime =   moment()
                            .add(15, 'minutes')
                            .subtract(moment().minute()%15, 'minutes')
                            .seconds(0).millisecond(0)
                            .utc().toISOString();
            for (var i in times) {
                var key = util.generateKey();
                var newTime = changeDateToToday(times[i].$value);
                if (minTime <= newTime) {
                    result[key] = newTime;
                }
            }
            if (_.isEmpty(result)) {
                var key = util.generateKey();
                result[key] = minTime;
            }
            return result;
        }
        
        var getPlaceFromTemplate = function () {
            var result   = {};
            var places   = angular.copy($scope.meeting.where);
            for (var i in places) {
                var place = {
                    city: places[i].city || '',
                    country_code: places[i].country_code || '',
                    image_url: places[i].image_url || '',
                    location: places[i].location || [],
                    name: places[i].name || '',
                    rating_url: places[i].rating_url || '',
                    type: places[i].type || '',
                    url: places[i].url || ''
                };
                var key = util.generateKey();
                result[key] = place;
            }
            return result;
        };
        
        var changeDateToToday = function (pastMoment) {
            var timeWithoutDate = moment(pastMoment).format('HH:mm:ss');
            return moment(timeWithoutDate, 'HH:mm:ss').utc().toISOString();
        };
        
        var activateFacebookSDK = function () {
            if (
                $window.$('.fb-share-button').length > 0 && 
                $window.$('#facebook-sdk').length === 0 &&
                $scope.meeting && $scope.getMeetingName($scope.meeting, true)
            ) {
                $window.$('body').append('<script id="facebook-sdk" src="//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.4"></script>');
            } else {
                setTimeout(activateFacebookSDK, 500);
            }   
        };        
        
        $scope.addComment = function () {
            var meetingId = $scope.currentMeetingId,
            content = $window.$('#new-comment').val();
        
            if (!content) {
                return false;
            }
            var data = {
                userId: $scope.currentUser.user.id || '',
                username: $scope.currentUser.user.fullName || 'Anonymous',
                avatar: $scope.currentUser.user.profileImageURL || '',
                time: moment().utc().toISOString(),
                content: content
            };
            commentService.addComment(meetingId, data);

            var newUser = {
                id: data.userId,
                name: data.username
            };
            var commentedUsers = angular.copy($scope.commentedUsers);
            commentedUsers.unshift(newUser);
            
            var notificationData = {
                type: 'comment',
                status: '1',
                users: commentedUsers,
                createdAt: moment().utc().toISOString(),
                meetId: $scope.meeting.id,
                meetName: $scope.meeting.name
            };

            for (var i in $scope.commentedUsers) {
                notificationService.addNotificationToUser($scope.commentedUsers[i].id, notificationData);
            }
            
            $scope.newComment = '';
            $window.$('#new-comment').val('');
        };
        
        $scope.getCommentTime = function (isoString) {
            return moment(isoString).format('MMMM Do') + ' at ' + moment(isoString).format('h:mma');
        }
        
        commentService.trackComment($scope.currentMeetingId);
        
        $scope.$on('comment.changed', function(evt, data) {
            $scope.comments = data;
            
            $scope.commentedUsers = [];
            var commentArray = Object.keys(data).reverse();
            for (var i in commentArray) {
                var key = commentArray[i];
                if (data[key] && data[key].userId && data[key].username && data[key].userId !== $.cookie('guid')) {
                    var userObject = {id: data[key].userId, name: data[key].username};
                    pushUserToArrayIfNotExist($scope.commentedUsers, userObject);
                }
            }
            console.log($scope.commentedUsers);
        });
        
        var pushUserToArrayIfNotExist = function(userArray, userObject) {
            var existed = false;
            for (var i in userArray) {
                if (userArray[i].id === userObject.id) {
                    existed = true;
                    break;
                }
            }
            
            if (!existed) {
                userArray.push(userObject);
            }
        };
        
        $scope.getGroupKey = function (group) {
            return group.where.$id + '+' + group.when.when.id;
        };
        
        $scope.checkCommentKey = function (event) {
            if (event.keyCode === 13) {
                $scope.addComment();
            }
        };
        
        $scope.getNumberOfCommentToShow = function () {
            return $scope.numberOfCommentToShow;
        };
        
        $scope.showMoreComment = function () {
            $scope.numberOfCommentToShow += 2;
        };
        
        $scope.displayShowMoreComment = function () {
            var comments = $scope.comments;
            var numberOfComment = Object.keys(comments).length;
            var numberToShow = $scope.getNumberOfCommentToShow();
            return numberOfComment > numberToShow;
        };
        
        $scope.getCommentsToShow = function () {
            var comments = $scope.comments;
            var commentArray = Object.keys(comments).map(function (key) {
                return comments[key];
            });
            
            var numberOfComment = Object.keys(comments).length;
            var numberToShow = $scope.getNumberOfCommentToShow();
            var startIndex = numberOfComment > numberToShow ? numberOfComment - numberToShow : 0;
            return commentArray.slice(startIndex, numberOfComment);
        };
        
        $scope.isToday = function (isoString) {
            return moment().format('YYYYMMDD') <= moment(isoString).format('YYYYMMDD');
        };
        
        $scope.encodeURIComponent = function(word) {
            return encodeURIComponent(word);
        }
        
        $scope.getICSFile = function (group) {
            var time = angular.copy(group.when.when.when);
            time = time.utc();
            var calendarContent = 
            "BEGIN:VCALENDAR" + "\r\n" + 
            "VERSION:2.0" + "\r\n" + 
            "PRODID:socialivo.com" + "\r\n" + 
            "BEGIN:VEVENT" + "\r\n" + 
            "UID:" + $scope.meeting.id + "--" + util.generateKey() + "\r\n" + 
            "DTSTAMP:" + time.format('YYYYMMDDTHHmm') + '00Z' + "\r\n" + 
            "ORGANIZER;CN=" + ( $scope.currentUser.user.fullName || "Jason") +
            ":MAILTO:" + ($scope.currentUser.user.email || "jason@socialivo.com") + "\r\n" + 
            "DTSTART:" + time.format('YYYYMMDDTHHmm') + '00Z' + "\r\n" + 
            "DTEND:" + time.add(1, 'hours').format('YYYYMMDDTHHmm') + '00Z' + "\r\n" + 
            "SUMMARY:" + $scope.meeting.name + "\r\n" + 
            "DESCRIPTION:" + $scope.getSharingUrl() + "\r\n" + 
            "LOCATION:" + group.where.name + ", " + group.where.location.display_address + "\r\n" + 
            "END:VEVENT" + "\r\n" + 
            "END:VCALENDAR";
    
            var href = 'data:text/calendar;charset=utf-8,' + encodeURI(calendarContent);
            
            var link = document.createElement("a");
            link.setAttribute("href", href);
            link.setAttribute("download", "event.ics");

            link.click();
        };
        
        $scope.getCorrectProtocolUrl = function(url) {
            return util.getCorrectProtocolUrl(url);
        };
        
        $scope.getTelPhoneNumber = function(phone) {
            if (!phone) {
                return '';
            }
            return phone.replace(RegExp('[-() ]','g'), '');
        };
        
        $window.$(document).ready(function() {
            sessionService.ready.then(function() {
                if (!sessionService.getViewedTutorialStatus() && !util.getUrlParams('rsvp')) {
                    setTimeout(function(){
                        $scope.startTutorial();
                        sessionService.setViewedTutorialStatus();
                    }, 100);
                }
            });
            
            $window.$('.box-meeting').on('click', '.button.facebook', function() {
                window.open($('.fb-share').attr('href'), 'fbShareWindow', 'height=450, width=550, top=' + ($(window).height() / 2 - 275) + ', left=' + ($(window).width() / 2 - 225) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
            });
            $window.$('.box-meeting').on('click', '.button.twitter', function(e) {
                window.open($('.twitter-share').attr('href'), 'twitterShareWindow', 'height=450, width=550, top=' + ($(window).height() / 2 - 275) + ', left=' + ($(window).width() / 2 - 225) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
            });
        });
    }]);
})();
