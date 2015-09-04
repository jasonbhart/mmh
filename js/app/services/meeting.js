;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    function Meeting(meetingId, appConfig, $rootScope, $q, $firebaseObject, $firebaseArray, $log, localMeetingService) {
        var resultDefer = $q.defer();

        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
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
                name: snap.val().name || 'New Meetup',
                refs: refs,
                users: $firebaseArray(refs.users),
                where: $firebaseArray(refs.where),
                when: $firebaseArray(refs.when)
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
                        $log.log('toggleWhere Remove: ', snap.ref().toString(), snap.val());
                        var id = _.keys(snap.val())[0];
                        snap.ref().child(id).remove(function() {
                            // remove place from the local Events
                            localMeetingService.remove(meetingId, id).then(function() {
                                defer.resolve(id);
                            });
                        });
                    } else if (!exists && state) {      // add
                        $log.log('toggleWhere Add: ', snap.ref().toString(), snap.val());
                        var whereRef = snap.ref().push({
                            type: where.type,
                            name: where.name,
                            city: where.city,
                            country_code: where.country_code,
                            url: where.url,
                            location: where.location
                        }, function() {
                            var id = whereRef.key();
                            // add place to the local Events
                            localMeetingService.add(meetingId, id, where.location.coordinate).then(function() {
                                defer.resolve(id);
                            });
                        });
                    } else if (exists) {
                        defer.resolve(_.keys(snap.val())[0]);
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
                        $log.log('toggleMeetWhen Remove: ', snap.ref().toString(), snap.val());
                        var id = _.keys(snap.val())[0];
                        snap.ref().child(id).remove(function() { defer.resolve(); });
                    } else if (!exists && state) {      // add
                        $log.log('toggleMeetWhen Add: ', snap.ref().toString(), snap.val());
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
                        when: $firebaseArray(userRefs.when)
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

                            if (exists && !state) {      // remove
                                $log.log('toggleWhere Remove: ', snap.ref().toString(), snap.val());
                                var id = _.keys(snap.val())[0];
                                snap.ref().child(id).remove();
                            } else if (!exists && state) {      // add
                                $log.log('toggleWhere Add: ', snap.ref().toString(), snap.val());
                                snap.ref().push(whereId);
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

                            if (exists && !state) {      // remove
                                $log.log('toggleWhen Remove: ', snap.ref().toString(), snap.val());
                                var id = _.keys(snap.val())[0];
                                snap.ref().child(id).remove();
                            } else if (!exists && state) {      // add
                                $log.log('toggleWhen Add: ', snap.ref().toString(), snap.val());
                                snap.ref().push(whenId);
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
                                $log.log('User toggleJoinGroup Remove: ', snap.ref().toString(), snap.val());
                                snap.ref().remove(function() {
                                    defer.resolve({group: group, joined: false});
                                });
                            } else if (!exists && state) {      // add
                                $log.log('User toggleJoinGroup Add: ', snap.ref().toString(), snap.val());
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
                            var whereRef = userObj.refs.where.push(result.group.whereId, function() {
                                var data = {};
                                data[whereRef.key()] = result.group.whereId;
                                userObj.refs.where.set(data);
                            });
                            var whenRef = userObj.refs.when.push(result.group.whenId, function() {
                                var data = {};
                                data[whenRef.key()] = result.group.whenId;
                                userObj.refs.when.set(data);
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
                $log.log('Meeting loaded', meetingObj);
                resultDefer.resolve(meetingObj);
            });
        });
        
        return resultDefer.promise;
    }

    app.factory('meetingService', ['$rootScope', '$q', '$firebaseObject', '$firebaseArray', '$log', 'appConfig', 'localMeetingService',
            function($rootScope, $q, $firebaseObject, $firebaseArray, $log, appConfig, localMeetingService) {

        var meetsUrl = appConfig.firebaseUrl + '/meets';
        var service = {
            create: function() {
                var defer = $q.defer();
                var ref = new Firebase(meetsUrl);
                var newMeeting = {
                    'name': 'New Meetup',
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

                    $log.log("New meeting created", meetingId);

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
            get: function(id) {
                return new Meeting(id, appConfig, $rootScope, $q, $firebaseObject, $firebaseArray, $log, localMeetingService);
            },
            convertWhen: function(when) {
                return moment.utc(when).local();
            },
            getSharingUrl: function(meetingId) {
                return appConfig.shareUrlBase + '?meet=' + meetingId;
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
             * @param {Array} meetings array of { meetingId:, whereId: }
             * @returns {Array}
             */
            getInfo: function(meetings) {
                var ref = new Firebase(meetsUrl);
                var deferreds = [];

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

                        var meeting = snap.val();
                        if (!meeting.where || !meeting.where[descr.whereId]) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }

                        var info = {
                            id: snap.key(),
                            name: meeting.name,
                            usersCount: _.keys(meeting.users).length,
                            where: meeting.where[descr.whereId]
                        };
                        
                        $rootScope.$applyAsync(function() {
                            meetDefer.resolve(info);
                        });
                    });
                });

                return $q.all(deferreds).then(function(results) {
                    var map = {};
                    results = _.filter(results);
                    $log.log('meetingService: getInfo:', results);
                    _.forEach(results, function(info) {
                        map[info.id] = info;
                    });
                    
                    return map;
                });
            }
        };

        return service;
    }]);
})();
