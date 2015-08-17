;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    function Meeting(id, appConfig, $q, $firebaseObject, $firebaseArray, $log) {
        var resultDefer = $q.defer();
        
        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        ref = ref.child(id);
        ref.once('value', function (snap) {
            if (!snap.exists()) {
                resultDefer.reject();
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
                refs: refs,
                users: $firebaseArray(refs.users),
                where: $firebaseArray(refs.where),
                when: $firebaseArray(refs.when)
            };
            
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
                        snap.ref().child(id).remove(function() { defer.resolve(); });
                    } else if (!exists && state) {      // add
                        $log.log('toggleWhere Add: ', snap.ref().toString(), snap.val());
                        var whereRef = snap.ref().push(where, function() { defer.resolve(whereRef.key()); });
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
                        resultDefer.reject();
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
                    
                    resultDefer.resolve(userObj);
                });
                
                return resultDefer.promise;
            };

            resultDefer.resolve(meetingObj);
        });
        
        return resultDefer.promise;
    }

    app.factory('meetingService', ['$q', '$firebaseObject', '$firebaseArray', '$log', 'appConfig',
            function($q, $firebaseObject, $firebaseArray, $log, appConfig, userService) {
        return {
            create: function() {
                
            },
            get: function(id) {
                return new Meeting(id, appConfig, $q, $firebaseObject, $firebaseArray, $log);
            },
            convertWhen: function(when) {
                return moment.utc(when).local();
            },
            getSharingUrl: function(meeting) {
                if (meeting && meeting.refs)
                    return appConfig.shareUrlBase + '?meet=' + meeting.refs.current.key();
                return null;
            }
        };
    }]);
})();
