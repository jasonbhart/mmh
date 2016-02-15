;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    function Meeting(meetingId, appConfig, $rootScope, $q, $firebaseObject, $firebaseArray, $log, localMeetingService) {
        var resultDefer = $q.defer();

        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        
        var loadingTimeout = null;
        ref = ref.child(meetingId);
        ref.once('value', function (snap) {
            if (!snap.exists()) {
                $rootScope.$applyAsync(function() {
                    resultDefer.reject();
                });
                return;
            }

            // prepare meeting object
            var refs = {
                current: ref,                               // current meeting ref
                users: ref.child('users'),                  // users participating in meeting, key: userId
                where: ref.child('where'),                  // available places for current meet
                when: ref.child('when')                     // available times for current meet
            };

            var meetingObj = {
                id: ref.key(),
                name: snap.val().name || 'New Activity',
                timeTitle: snap.val().timeTitle || '',
                createdDate: snap.val().createdDate,
                specificLocation: snap.val().specific_location || '',
                category: snap.val().category || '',
                refs: refs,
                users: $firebaseArray(refs.users),
                where: $firebaseArray(refs.where),
                when: $firebaseArray(refs.when),
                meetMeHere: snap.val().meetMeHere || ''
            };

            meetingObj.addUser = function(id) {
                var defer = $q.defer();

                // search by url (as a key)
                refs.users.child(id).update({ joined: true }, function(error) {
                    if (error)
                        defer.reject(error);
                    else
                        defer.resolve(id);
                });

                return defer.promise;
            }

            /**
             * {
             *   type: '',
             *   name: '',
             *   url: '',
             *   city: '',
             *   country_code: '',
             *   location: { display_address: '', coordinate: { lat: 1, lng: 1 } }
             * }
             * @param {Object} where
             * @param {bool} state
             * @returns {promise}
             */
            // add/remove suggestion to/from available suggestions for meet
            meetingObj.toggleWhere = function (where, state) {
                var defer = $q.defer();

                // search by url (as a key)
                refs.where
                    .orderByChild('url')
                    .equalTo(where.url)
                    .once('value', function(snap)
                {
                    var exists = snap.exists();

                    if (state === undefined) {          // toggle
                        state = !exists;
                    }

                    if (exists && !state) {      // remove
                        var id = _.keys(snap.val())[0];
                        snap.ref().child(id).remove(function() {
                            // remove place from the local Events
                            localMeetingService.remove(meetingId, id).then(function() {
                                defer.resolve(id);
                            });
                        });
                    } else if (!exists && state) {      // add
                        var whereRef = snap.ref().push({
                            type: where.type,
                            name: where.name,
                            city: where.city,
                            country_code: where.country_code,
                            url: where.url,
                            image_url: where.image_url,
                            location: where.location,
                            categories: where.categories,
                            rating_url: where.rating_url
                        }, function() {
                            var id = whereRef.key();
                            // add place to the local Events
                            localMeetingService.add(meetingId, id, where.location.coordinate).then(function() {
                                defer.resolve(id);
                            });
                        });
                    } else {
                        defer.reject();
                    }
                });

                return defer.promise;
            }
            
            meetingObj.findWhenByValue = function(whenMoment) {
                var defer = $q.defer();
                
                whenMoment = whenMoment.clone().utc().toISOString();
                
                refs.when
                    .orderByValue()
                    .equalTo(whenMoment)
                    .once('value', function(snap) {
                        
                        if (snap.exists()) {
                            defer.resolve(snap.val());
                        } else {
                            defer.reject();
                        }
                    });
                    
                return defer.promise;
            }
            
            // add/remove time to/from available times for meet
            meetingObj.toggleWhen = function (whenMoment, state) {
                var defer = $q.defer();
                
                // save datetime in UTC
                whenMoment = whenMoment.clone().utc().toISOString();

                refs.when
                    .orderByValue()
                    .equalTo(whenMoment)
                    .once('value', function(snap)
                {
                    var exists = snap.exists();

                    if (state === undefined) {          // toggle
                        state = !exists;
                    }

                    if (exists && !state) {      // remove
                        var id = _.keys(snap.val())[0];
                        snap.ref().child(id).remove(function() { defer.resolve(); });
                    } else if (!exists && state) {      // add
                        var whenRef = snap.ref().push(whenMoment, function() { defer.resolve(whenRef.key()); });
                    }  else if (exists) {
                        defer.resolve(_.keys(snap.val())[0]);
                    } else {
                        defer.reject();
                    }
                });

                return defer.promise;
            }

            meetingObj.getUser = function(userId) {
                var resultDefer = $q.defer();
                
                refs.users.child(userId).once('value', function(snap) {
                    if (!snap.exists()) {
                        $rootScope.$applyAsync(function() {
                            resultDefer.reject();
                        });
                        return;
                    }
                    
                    var currentRef = snap.ref();
                    var userRefs = {
                        current: currentRef,
                        where: currentRef.child('where'),
                        when: currentRef.child('when')           
                    };
                    
                    var userObj = {
                        refs: userRefs,
                        where: $firebaseArray(userRefs.where),
                        when: $firebaseArray(userRefs.when),
                        userId: userId
                    };
                    
                    userObj.toggleWhere = function (whereId, state) {
                        userRefs.where
                                .orderByValue()
                                .equalTo(whereId)
                                .once('value', function(snap) {
                            var exists = snap.exists();

                            if (state === undefined) {          // toggle
                                state = !exists;
                            }

                            clearTimeout(loadingTimeout);
                            loadingTimeout = setTimeout(function() {
                                $('.loading-wrap').show();
                            }, 500);
                            
                            if (exists && !state) {      // remove
                                var id = _.keys(snap.val())[0];
                                snap.ref().child(id).remove(function() {
                                    clearTimeout(loadingTimeout);
                                    $('.loading-wrap').hide();
                                });
                            } else if (!exists && state) {      // add
                                snap.ref().push(whereId, function() {
                                    clearTimeout(loadingTimeout);
                                    $('.loading-wrap').hide();
                                });
                            }
                        });
                    };

                    // toggle time for user
                    userObj.toggleWhen = function (whenId, state) {
                        userRefs.when
                                .orderByValue()
                                .equalTo(whenId)
                                .once('value', function(snap) {
                            var exists = snap.exists();

                            if (state === undefined) {          // toggle
                                state = !exists;
                            }

                            clearTimeout(loadingTimeout);
                            loadingTimeout = setTimeout(function() {
                                $('.loading-wrap').show();
                            }, 500);
                            if (exists && !state) {      // remove
                                var id = _.keys(snap.val())[0];
                                snap.ref().child(id).remove(function(){
                                    clearTimeout(loadingTimeout);
                                    $('.loading-wrap').hide();
                                });
                                
                            } else if (!exists && state) {      // add
                                snap.ref().push(whenId, function () {
                                    clearTimeout(loadingTimeout);
                                    $('.loading-wrap').hide();
                                });
                                
                            } else {
                                clearTimeout(loadingTimeout);
                                $('.loading-wrap').hide();
                            }
                        });
                    };
                    
                    userObj.removeAllWhen = function() {
                        userObj.refs.when.remove();
                    }
                    
                    userObj.toggleJoinGroup = function (group, state) {
                        var defer = $q.defer();
                        userObj.refs.current.child('group').once('value', function(snap) {
                            var exists = snap.exists();

                            if (state === undefined) {          // toggle
                                state = !exists;
                            }

                            // new group and current group are not equal 
                            // set group to new group
                            if (exists && !state) {
                                var val = snap.val();
                                if (group && (group.whereId != val.where || group.whenId != val.when)) {
                                    exists = false;
                                    state = true;
                                }
                            }

                            if (exists && !state) {      // remove
                                snap.ref().remove(function() {
                                    defer.resolve({group: group, joined: false});
                                });
                            } else if (!exists && state) {      // add
                                snap.ref().set({
                                    where: group.whereId,
                                    when: group.whenId
                                }, function() {
                                    defer.resolve({group: group, joined: true});
                                });
                            }
                        });

                        return defer.promise;
                    };

                    /*
                     * Joins group and forgets about other places/times except those in the joined group
                     * @param object group { whereId:, whenId: }
                     */
                    userObj.joinGroup = function(group) {
                        userObj.toggleJoinGroup(group).then(function(result) {
                            if (!result.joined)
                                return;

                            // remove all where and when and set only those in the joined group
                            clearTimeout(loadingTimeout);
                            loadingTimeout = setTimeout(function() {
                                $('.loading-wrap').show();
                            }, 500);
                            var whereRef = userObj.refs.where.push(result.group.whereId, function() {
                                var data = {};
                                data[whereRef.key()] = result.group.whereId;
                                userObj.refs.where.set(data);
                                clearTimeout(loadingTimeout);
                                $('.loading-wrap').hide();
                            });
                            var whenRef = userObj.refs.when.push(result.group.whenId, function() {
                                var data = {};
                                data[whenRef.key()] = result.group.whenId;
                                userObj.refs.when.set(data);
                                clearTimeout(loadingTimeout);
                                $('.loading-wrap').hide();
                            });
                        });
                    };
                    
                    $rootScope.$applyAsync(function() {
                        resultDefer.resolve(userObj);
                    });
                });
                
                return resultDefer.promise;
            };

            $rootScope.$applyAsync(function() {
                resultDefer.resolve(meetingObj);
            });
        });
        
        return resultDefer.promise;
    }

    app.factory('meetingService', ['$rootScope', '$q', '$firebaseObject', '$firebaseArray', '$log', 'appConfig', 'localMeetingService', 'util',
            function($rootScope, $q, $firebaseObject, $firebaseArray, $log, appConfig, localMeetingService, util) {

        var meetsUrl = appConfig.firebaseUrl + '/meets';
        var service = {
            create: function(meetingDataObject) {
                var defer = $q.defer();
                var ref = new Firebase(meetsUrl);
                var newMeeting = meetingDataObject || {
                    'name': 'New Activity',
                    'createdDate': moment().utc().toISOString()
                };

                var postIdRef = ref.push(newMeeting, function(error) {
                    if (error) {
                        $rootScope.$applyAsync(function() {
                            defer.reject(error);
                        });
                        return;
                    }

                    var meetingId = postIdRef.key();

                    // load meeting data
                    service.get(meetingId).then(function(meeting) {
                        $rootScope.$applyAsync(function() {
                            defer.resolve(meeting);            
                        });
                    }, function(error) {
                        $rootScope.$applyAsync(function() {
                            defer.reject(error);
                        });
                    });
                });
                
                return defer.promise;
            },
            update: function(id, data) {
                var ref = new Firebase(meetsUrl);
                ref.child(id).set(data);
            },
            get: function(id) {
                return new Meeting(id, appConfig, $rootScope, $q, $firebaseObject, $firebaseArray, $log, localMeetingService);
            },
            getRaw: function (id) {
                var ref = new Firebase(meetsUrl);
                return $firebaseObject(ref.child(id));
            },
            getLastMeetings: function (limit, startAt) {
                var ref = new Firebase(meetsUrl);
                
                var lastMeetingsRef = ref.orderByKey().limitToLast(limit);
                
                if (startAt && typeof startAt === 'string') {
                    lastMeetingsRef = lastMeetingsRef.startAt(startAt);
                }
//                return $firebaseObject(ref.orderBy('createdDate').startAt('2016-02-02T09:27:04.829Z').limitToLast(limit));
                return $firebaseObject(lastMeetingsRef);
            },
            checkGroupExisted: function (meetId, groupId) {
                var ref = new Firebase(meetsUrl);
                return $firebaseObject(ref.child(meetId).child(groupId));
            },
            convertWhen: function(when) {
                return moment.utc(when).local();
            },
            getActivityUrl: function(meetingId) {
                return appConfig.shareUrlBase + '?act=' + meetingId;
            },
            getSharingUrl: function(meetingId) {
                return appConfig.shareLandingPageUrl + '?act=' + meetingId;
            },
            getFacebookSharingUrl: function(meetingId, meetingName) {
                return appConfig.shareFacebookUrl + '?data=' + meetingId + '*---*' + encodeURIComponent(meetingName);
            },
            getFacebookSharingUrlWithoutEncode: function(meetingId, meetingName) {
                return appConfig.shareFacebookUrl + '?data=' + meetingId + '*---*' + meetingName;
            },
            getExpireTime: function (times) {
                var expireTime = "";
                _.forEach(times, function(time) {
                    if (typeof time === 'object' && time.$value) {
                        var timeString = time.$value;
                    } else if (typeof time === 'object') {
                        var timeString = time.utc().toISOString();
                    } else {
                        var timeString = time;
                    }
                    
                    if (timeString > expireTime) {
                        expireTime = timeString;
                    }
                });
                return expireTime;
            },
            migrateUser: function(meetingId, srcUserId, dstUserId, keepSrc, overwrite) {
                var defer = $q.defer();
                var meetingsRef = new Firebase(meetsUrl);
                var meetingObject = $firebaseObject(meetingsRef.child(meetingId))
                meetingObject.$loaded().then(function(snap) {
                    if (!meetingObject.users || !meetingObject.users[srcUserId]) {
                        return;
                    }
                    var srcObject = meetingObject.users[srcUserId];
                    if (!meetingObject.users[dstUserId]) {
                        meetingObject.users[dstUserId] = {joined: true};
                    }
                    var dstObject = meetingObject.users[dstUserId];
                    if (overwrite) {
                        dstObject.when = _.clone(srcObject.when);
                        dstObject.where =  _.clone(srcObject.where);
                    } else {
                        dstObject.when = service.mergeObject(srcObject.when, dstObject.when || {});
                        dstObject.where = service.mergeObject(srcObject.where, dstObject.where || {});
                    }
                    
                    if (!keepSrc) {
                        delete meetingObject.users[srcUserId];
                    }
                    meetingObject.$save();
                    defer.resolve();
                });
                return defer.promise;
            },
            mergeObject: function(srcObject, dstObject) {
                if (!srcObject) {
                    return dstObject;
                }
                var dstValues = Object.keys(dstObject).map(function (key) {return dstObject[key]});
                _.forEach(srcObject, function(value, key) {
                    if (dstValues.indexOf(value) === -1) {
                        dstObject[key] = value;
                    }
                });
                return dstObject;
            },
            getMeetingName: function(meeting, includeTime) {
                if (!meeting || !meeting.name) {
                    return '';
                }
                if (includeTime && meeting.timeTitle) {
                    return meeting.name + ' at ' + moment(meeting.timeTitle).format('h:mmA');
                }
                return meeting.name;
            },
            copyData: function(srcUserId, dstUserId, removeSrcRecords) {
                var defer = $q.defer();

                // TODO: this is very inefficient. Refactoring needed
                // we don't need to fetch all meeting, data volume can be very huge
                // 1. need to store meet ids where user participates (so we won't iterate all meetings)
                // 2. need to store where/when values on user nodes like whereId: true (currently it is someKey: whereId)
                var meetingsRef = new Firebase(meetsUrl);
                meetingsRef.once('value', function(snap) {
                    if (!snap.exists()) {
                        defer.resolve();
                        return;
                    }

                    // check each meeting
                    _.forEach(snap.val(), function(meeting, meetingId) {
                        if (!meeting.users)
                            return;
                        if (!(srcUserId in meeting.users))
                            return;

                        var dstRef = meetingsRef.child(meetingId + '/users/' + dstUserId);
                        // update nodes
                        var data = meeting.users[srcUserId];

                        // TODO: this needs to be changed accordingly description above (2.)
                        _.forEach(['where', 'when'], function(node) {
                            var ref = dstRef.child(node);
                            ref.once('value', function(snap) {
                                var existing = snap.exists() ? _.values(snap.val()) : [];

                                var notExisting = _.difference(
                                    _.values(data[node]),
                                    existing
                                );
                                _.forEach(notExisting, function(id) {
                                    ref.push(id);
                                });
                            });
                        });

                        if (data.group)
                            dstRef.child('group').set(data.group);

                        if (removeSrcRecords)
                            meetingsRef.child(meetingId + '/users/' + srcUserId).remove();
                    });

                    defer.resolve();
                });

                return defer.promise;
            },
            /**
             * @param {Array} meetings array of { meetingId:, whereId: ? }
             * @returns {Array}
             */
            getInfo: function(meetings) {
                var ref = new Firebase(meetsUrl);
                var deferreds = [];

                // allow to passing object
                if (!_.isArray(meetings))
                    meetings = [meetings];

                _.forEach(meetings, function(descr) {
                    var meetDefer = $q.defer();
                    deferreds.push(meetDefer.promise);

                    ref.child(descr.meetingId).once('value', function(snap) {
                        if (!snap.exists()) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }

                        var whereId = descr.whereId;
                        var meeting = snap.val();
                        if (!meeting.where
                                || (whereId && !meeting.where[whereId])) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }

                        if (!whereId)
                            whereId = _.keys(meeting.where)[0];
                        
                        var whenId = descr.whenId || _.keys(meeting.when)[0];

                        var id = snap.key();
                        var joinedUser = [];
                        _.forEach(meeting.users, function(user, userId) {
                            if (user.group && user.group.when == descr.whenId && user.group.where == descr.whereId) {
                                joinedUser.push(userId);
                            }
                        });
                        
                        var info = {
                            id: id,
                            name: meeting.name,
                            users: joinedUser,
                            where: meeting.where[whereId],
                            url: service.getActivityUrl(id),
                            timeTitle: meeting.when[whenId],
                            when: meeting.when[whenId],
                            allUsers: meeting.users,
                            createdDate: meeting.createdDate
                        };
                        
                        $rootScope.$applyAsync(function() {
                            meetDefer.resolve(info);
                        });
                    });
                });

                return $q.all(deferreds).then(function(results) {
                    var map = {};
                    results = _.filter(results);
                    _.forEach(results, function(info) {
                        map[info.id] = info;
                    });

                    return map;
                });
            },
            calculateDistanceToMeeting: function (meeting, mapOptions) {
                if (!meeting.where) {
                    return 10000;
                }
                for (var i in meeting.where) {
                    meeting.display_address =  meeting.where[i].location.display_address;
                    meeting.location_name =  meeting.where[i].name;
                    meeting.type =  util.toTitleCase(meeting.where[i].type);
                    return util.getDistanceFromLatLonInKm(
                        meeting.where[i].location.coordinate.lat,
                        meeting.where[i].location.coordinate.lng,
                        mapOptions.coords.lat,
                        mapOptions.coords.lng
                    );
                }
                return 1000;
            },
            checkIfFinished: function (times) {
                var finished = true;
                _.forEach(times, function(time) {
                    if (moment().diff(moment(time)) < 2 * 3600 * 1000) {
                        finished = false;
                    }
                });
                return finished;
            },
            getCreatorId: function(users) {
                for (var i in users) {
                    if (users[i].creator) {
                        return i;
                    }
                }
                return Object.keys(users)[0];
            }
        };

        return service;
    }]);
})();
