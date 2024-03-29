;(function() {
    'use strict';

    var firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';

    var mmhApp = angular.module(
        'mmh',
        [
            'ngCookies',
            'firebase',
            //'ui.bootstrap',
            'ui.materialize',
            'mmh.services',
            'mmh.directives',
            'mmh.controllers',
            'customFilters'
        ]
    );
    
    mmhApp.filter('stripUrlSchema', function() {
        return function(input) {
            return (input || '').replace(/^\w+\:\/\//, '//');
        }
    });

    // used to get new places and times
    function getObjectValuesDiff(obj, excludeObj) {
        // merge places
        var values1 = [];
        var values2 = [];
        if (obj) {
            for (var id in obj) {
                if (!obj.hasOwnProperty(id))
                    continue;

                values1.push(obj[id]);
            }

            if (excludeObj) {
                for (var id in excludeObj) {
                    if (!excludeObj.hasOwnProperty(id))
                        continue;

                    values2.push(excludeObj[id]);
                }
            }
        }
        
        return _.difference(values1, values2);
    }
    
    function mergeUserDataBySnapshots(srcUserSnap1, dstUserSnap2) {
        var srcUser1 = srcUserSnap1.val();
        var dstUser2 = dstUserSnap2.val() || {};
        var dstUserRef = dstUserSnap2.ref();

        var newWhere = getObjectValuesDiff(srcUser1.where, dstUser2.where);
        var whereRef = dstUserRef.child('where');
        for (var i=0; i<newWhere.length; i++) {
            whereRef.push(newWhere[i]);
        }

        var newWhen = getObjectValuesDiff(srcUser1.when, dstUser2.when);
        var whenRef = dstUserRef.child('when');
        for (var i=0; i<newWhen.length; i++) {
            whenRef.push(newWhen[i]);
        }
    }

    mmhApp.controller('main', ['$scope', '$q', '$window', '$log', '$cookies', '$firebaseObject', '$firebaseArray', 'geoLocation', 'userGroupBuilder', '$modal', 'dataProvider', 'util',
                        function($scope, $q, $window, $log, $cookies, $firebaseObject, $firebaseArray, geoLocation, userGroupBuilder, $modal, dataProvider, util) {

        var anonymousIdCookie = 'anonymousId';
        var USER_TYPE_ANONYMOUS = 1;
        var USER_TYPE_FACEBOOK = 2;
        var DEFAULT_RADIUS = 1;
        
        $scope.identity = {
            id: undefined, //Math.abs(Math.round(Math.random() * Math.pow(2, 32))),           // random uid
            name: undefined,
            logged: false
        };

        $scope.timeFormat = 'h:mma';
        $scope.customWhen = null;

        var meetId, isNew = false;
        var refs = {};
        refs.meet = new Firebase(firebaseUrl + '/meets');

        // load or create meeting
        if (util.getUrlParams('meet')) {
            meetId = util.getUrlParams('meet');
        } else {
            var postIdRef = refs.meet.push({
                'name': 'New Meetup',
                'createdDate': moment().utc().toISOString()
            });

            meetId = postIdRef.key();
            isNew = true;
        }

        refs.meet = refs.meet.child(meetId);                                // current meeting info
        refs.users = new Firebase(firebaseUrl + '/users');                  // stores all users info
        refs.suggestions = new Firebase(firebaseUrl + '/suggestions');      // stores user specific suggestions, key: userid
        refs.meetUsers = refs.meet.child('users');                          // users participating in meeting, key: userId
        refs.meetWhere = refs.meet.child('where');                          // available places for current meet
        refs.meetWhen = refs.meet.child('when');                            // available times for current meet
        refs.userSuggestions = null;
        
        var meetUsersArray = $firebaseArray(refs.meetUsers);
        var meetWhereArray = $firebaseArray(refs.meetWhere);
        var meetWhenArray = $firebaseArray(refs.meetWhen);
        var userSuggestionsArray;
        var meetUserObject;
        var userObject;

        $scope.shareUrl = 'https://radiant-heat-9175.firebaseapp.com?meet=' + meetId;
        $scope.suggestions = null;
        var usersInfo = {};      // user's name, status etc. with elements of type $firebaseObject
        $scope.selectionTable = [];
        $scope.userGroups = [];

        // add when
        var dateObject = new Date();
        var newWhen = generateHours(dateObject, 3);
        for (var i=0; i<newWhen.length; i++) {
            toggleMeetWhen(newWhen[i], true);
        }

        // watch identity changes
        $scope.$watch('identity', function(newVal, oldVal) {
            if (oldVal.id !== newVal.id) {

                // merge user's meet data and remove anonymous user
                if (oldVal.id !== undefined && oldVal.logged === false) {
                    
                    refs.meetUsers.orderByKey().equalTo(oldVal.id).once('value', function(meetAnonSnap) {
                        // anonymous doesn't exist
                        if (!meetAnonSnap.exists()) {
                            initUser();
                            return;
                        }
                        
                        var value = meetAnonSnap.val();
                        var id = Object.keys(value)[0];
                        meetAnonSnap = meetAnonSnap.child(id);
                        var meetAnonRef = meetAnonSnap.ref();
                        var anonRef = refs.users.child(oldVal.id);

                        // load authenticated user's data
                        refs.meetUsers.orderByKey().equalTo(newVal.id).once('value', function(meetUserSnap) {
                            meetUserSnap = meetUserSnap.child(newVal.id);

                            mergeUserDataBySnapshots(meetAnonSnap, meetUserSnap);
                            
                            meetAnonRef.remove();
                            anonRef.remove();
                            initUser();
                        });
                    });
                } else {
                    initUser();
                }
            }
        }, true);

        $window.fbAsyncInit = function() {
            $window.FB.init({
                    appId      : '450586198440716',
                    cookie     : true,  // enable cookies to allow the server to access
                                                            // the session
                    xfbml      : true,  // parse social plugins on this page
                    version    : 'v2.2', // use version 2.2
                    status     : false       // get user login status asap. This works but only if user is logged in
            });

            var authResponse = {};

            function fbAuthStatusChange(response) {

                // somewhy it happens twice
                if (authResponse.status == response.status && authResponse.authResponse == response.authResponse)
                    return;
                
                authResponse = response;
                
                if (response.status == 'connected' && response.authResponse) {
                    $window.FB.api('/me', function(response) {
                        // user is authenticated, remove anonymousId cookie
                        delete $cookies[anonymousIdCookie];

                        refs.users.orderByChild('facebookid').equalTo(response.id).once('value', function(snap) {
                            if (!snap.exists()) {
                                createUser({
                                    facebookid: response.id,    // + Math.round(Math.random()*1000).toString();
                                    name: response.name,
                                    logged: true
                                }, function(ref) {
                                    changeUser(ref.key(), USER_TYPE_FACEBOOK);
                                });
                            } else {
                                var id = _.keys(snap.val())[0];
                                changeUser(id, USER_TYPE_FACEBOOK);
                            }
                        });

                        //$scope.identity.pictureUrl = '//graph.facebook.com/' + response.id + '/picture?width=100&height=100';
                    });
                } else {
                    // get anonymous user id previously store in cookie
                    var id = $cookies[anonymousIdCookie];

                    // notify $scope that user has changed
                    var onGetAnonymousUser = function (id) {
                        $cookies[anonymousIdCookie] = id;
                        changeUser(id, USER_TYPE_ANONYMOUS);
                    }

                    // check if such anonymous user exists
                    if (id) {
                        refs.users.orderByChild('anonymousid').equalTo(id).once('value', function(snap) {
                            // no such user exists for current meeting
                            if (!snap.exists()) {
                                createAnonymousUser(onGetAnonymousUser);
                            } else {
                                // user exists
                                var value = snap.val();
                                value = value[Object.keys(value)[0]];
                                onGetAnonymousUser(value.id);
                            }
                        });
                    } else {
                        // new visit
                        createAnonymousUser(onGetAnonymousUser);
                    }
                }
            }

            $window.FB.getLoginStatus(fbAuthStatusChange, true);      // need to call this because status in init doesn't work
            $window.FB.Event.subscribe('auth.statusChange', fbAuthStatusChange);    // subscribe for status changes
        };
        (function(d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) return;
                js = d.createElement(s); js.id = id;
                js.src = '//connect.facebook.net/en_US/sdk.js';
                fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));

        $scope.getProfilePictureUrl = function(user) {
            if (user.facebookid)
                return '//graph.facebook.com/' + user.facebookid + '/picture?width=100&height=100';
            return null;
        }

        function generateHours(date, number) {
            var hours = [];
            var m = moment(date).minutes(0).seconds(0).milliseconds(0);
            
            for (var i=1; i<=number; i++) {
                m.add(1, 'hour');
                hours.push(m.clone());
            }

            return hours;
        }

        function createAnonymousUser(onComplete) {
            createUser({
                name: 'Anonymous',
                logged: false
            }, function(ref) {
                ref.update({ anonymousid: ref.key() }, function() {
                    onComplete(ref.key());
                });
            });
        }

        function createUser(user, onComplete) {
            var ref = refs.users.push(user, function() {
                ref.update({
                    id: ref.key()
                }, function() {
                    onComplete(ref)
                });
            });
        }
 
        function changeUser(userId, userType) {
            refs.users.orderByChild('id').equalTo(userId).once('value', function(userSnap) {
                if (!userSnap.exists())
                    return;

                var val = userSnap.val();
                var key = Object.keys(val)[0];
                var user = val[key];

                $scope.$apply(function() {
                    // load identity
                    $scope.identity.id = user.id;
                    $scope.identity.name = user.name;
                    $scope.identity.logged = user.logged;
                    $scope.identity.userType = userType;
                });
            });
        }
                            
        function initUser() {

            var id = $scope.identity.id;
            refs.meetUser = refs.meetUsers.child(id);
            meetUserObject = new $firebaseObject(refs.meetUser);
            userObject = new $firebaseObject(refs.users.child(id));

            meetUserObject.$loaded().then(function() {
                // add current user to the current meeting
                refs.userSuggestions = refs.suggestions.child(id);
                refs.meetUser.update({joined: true});
                refs.userWhere = refs.meetUser.child('where');
                refs.userWhen = refs.meetUser.child('when');

                userSuggestionsArray = $firebaseArray(refs.userSuggestions);
                
                userSuggestionsArray.$loaded().then(function() {
                    // load default suggestions
                    if (userSuggestionsArray.length == 0) {
                        dataProvider.getSuggestions().then(function(suggestions) {
                            _.forEach(suggestions, function(e) {
                                refs.userSuggestions.push(e);
                            });
                        });
                    }
                });
                $scope.suggestions = userSuggestionsArray;
                
                makeSelectionTable();
            });

            userObject.$loaded().then(function() {
                if (!userObject.location) {
                    geoLocation.getCurrentLocation().then(
                        function(location) {
                            location.radius = DEFAULT_RADIUS;
                            changeLocation(refs.users.child(userObject.$id), location);
                        }, function(error) {
                            $log.log('geoLocation error', error);
                        }
                    );
                }
            });
        }

        // updates location and loads location specific suggestions
        function changeLocation(userRef, location) {
            userRef.update(
                { location: location },
                function() {
                    var options = null;
                    if (location) {
                        options = {
                            coords: location.coords,
                            radius: dataProvider.convertMilesToKms(location.radius)
                        };
                    }
                    
                    // load suggestions
                    dataProvider.getSuggestions(options).then(function(suggestions) {
                        refs.userSuggestions.remove(function(error) {
                            if (error)
                                return;
                            _.forEach(suggestions, function(e) {
                                refs.userSuggestions.push(e);
                            });
                        });
                    }, function(error) {
                        alert(error);
                        $log.log('changeLocation: ', error);
                    });
                }
            );
        }

        function getFormattingData() {
            var where = meetWhereArray;

            // convert datetime to local
            var when = _.map(meetWhenArray, function(when) {
                return {
                    id: when.$id,
                    when: moment.utc(when.$value).local()
                };
            }).sort(function(a, b) {
                if (a.when < b.when)
                    return -1;
                else if (a.when > b.when)
                    return 1;
                return 0;
            });
            
            return {
                users: usersInfo,
                where: where,
                when: when
            };
        }

        $scope.changeLocation = function() {
            var options = {
                templateUrl: 'js/app/tmpl/locationMap.html?v=2',
                controller: 'LocationMapCtrl',
                size: 'lg',
                windowClass: 'location-map-modal',
                resolve: {
                    location: function() {
                        return null;
                    }
                }
            };

            // position map to current user location if we have such
            if (userObject.location) {
                options.resolve.location = function() {
                    return  {
                        position: {
                            lat: userObject.location.coords.lat,
                            lng: userObject.location.coords.lng
                        },
                        radius: userObject.location.radius
                    };
                };
            }

            var modal = $modal.open(options);
            modal.result.then(function(result) {
                if (!result)
                    return;

                geoLocation.getLocality(result.position.lat, result.position.lng).then(
                    function(location) {
                        location.radius = result.radius;
                        changeLocation(refs.users.child(userObject.$id), location);
                    }, function(error) {
                        $window.alert('Failed to change location: ' + error);
                        $log.log('geoLocation error', error);
                    }
                );
            });
        }

        // helpers
        function makeSelectionTable() {

            var data = {
                user: null,
                others: []
            };

            var formattingData = getFormattingData();
            
            // join meet users with selected suggestions
            meetUsersArray.forEach(function(meetUser) {

                // meeting user record doesn't have related user
                if (!formattingData.users[meetUser.$id]) {
                    return;
                }

                var selectedWhere = _.invert(meetUser.where);
                var selectedWhen = _.invert(meetUser.when);
                       
                var record = {
                    user: formattingData.users[meetUser.$id],
                    where: [],
                    when: [],
                    confirmed: meetUser.group       // did user joined some group ?
                };

                // fill when
                for (var i=0; i<formattingData.when.length; i++) {
                    var when = formattingData.when[i];
                    var w = {
                        whenId: when.id,
                        when: when.when.format($scope.timeFormat),
                        selected: when.id in selectedWhen
                    };
                    
                    w.cssClasses = [
                        w.selected ? 'special': 'alt'
                    ];
                    
                    record.when.push(w);
                }

                // fill where
                formattingData.where.forEach(function(sugg) {
                    var w = {
                        suggestionId: sugg.$id,
                        suggestion: sugg,
                        selectionId: sugg.$id in selectedWhere ? selectedWhere[sugg.$id] : null
                    };
                    
                    w.cssClasses = [
                        w.selectionId ? 'special': 'alt'
                    ];
                    
                    record.where.push(w);
                });

                if ($scope.identity.id && record.user.id == $scope.identity.id) {
                    data.user = record;
                }
                else
                    data.others.push(record);      
            });
            
            $scope.selectionTable = data;

            $scope.userGroups = buildUserGroups(formattingData);
        }
        
        function buildUserGroups(formattingData) {
            var whenMap = {};
            _.forEach(formattingData.when, function(w) {
                whenMap[w.id] = w.when;
            });

            // build groups
            var groups = userGroupBuilder.build(
                _.map(meetUsersArray, function(u) {
                    var location = formattingData.users[u.$id]
                        ? formattingData.users[u.$id].location || null : null;
                    return {
                        userId: u.$id,
                        location: location,
                        whereIds: _.values(u.where),
                        whenIds: _.values(u.when)
                    }
                }),
                whenMap
            );

            // format groups
            var result = [];
            _.forEach(groups, function(group) {

                // we want groups with more then 1 participant
                if (group.userIds.length < 2)
                    return;
                
                var users = _.map(group.userIds, function(id) {
                    return formattingData.users[id];
                });
                    
                var where = _.find(formattingData.where, function(w) {
                    return w.$id == group.where.id;
                });
                
                var when = _.find(formattingData.when, function(w) {
                    return w.id == group.when.id;
                });

                var joined = _.filter(group.userIds, function(id) {
                    var u = meetUsersArray.$getRecord(id);
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
            _.forOwn(formattingData.users, function(u) {
                if (!userNames[u.name]) {
                    userNames[u.name] = [];
                }
                userNames[u.name].push(u.id);
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

        $scope.addWhen = function(whenMoment) {
            toggleMeetWhen(whenMoment, true).then(function(whenId) {
                toggleWhen(refs.meetUser, whenId, true);
            });
        }

        // selection/deselection of place by user
        $scope.selectWhere = function(user, where) {
            toggleWhere(refs.meetUser, where.suggestionId);
        }

        $scope.selectWhen = function(whenId) {
            toggleWhen(refs.meetUser, whenId);
        }
        
        function toggleJoinGroup(meetUserRef, group, state) {
            var defer = $q.defer();
            meetUserRef.child('group').once('value', function(snap) {
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
        }

        $scope.joinGroup = function(group) {
            toggleJoinGroup(
                refs.meetUser,
                {
                    whereId: group.where.$id,
                    whenId: group.when.when.id
                }
            ).then(function(result) {
                if (!result.joined)
                    return;

                // remove all where and when and set only those in the joined group
                var whereRef = refs.meetUser.child('where').push(result.group.whereId, function() {
                    var data = {};
                    data[whereRef.key()] = result.group.whereId;
                    refs.meetUser.child('where').set(data);
                });
                var whenRef = refs.meetUser.child('when').push(result.group.whenId, function() {
                    var data = {};
                    data[whenRef.key()] = result.group.whenId;
                    refs.meetUser.child('when').set(data);
                });
            });
        }

        meetWhereArray.$watch(function(event) {
            makeSelectionTable();
        });

        meetWhenArray.$watch(function(event) {
            makeSelectionTable();
        });


        // watch for meet users changes
        var meetUsersEventHandler = function(event) {
            if (event.event == 'child_added') {
                // load user info
                
                // get meet user
                var mu = _.find(meetUsersArray, function(mu) {
                    return mu.$id == event.key;
                });
                
                // search user info
                var user = _.find($scope.users, function(u) {
                    return u.id == mu.id;
                });
                
                // do not have ?
                if (!user) {
                    // find user
                    usersInfo[event.key] = $firebaseObject(refs.users.child(event.key));
                    usersInfo[event.key].$loaded(makeSelectionTable);
                    return;
                }
            }
            
            if (event.event == 'child_removed') {
                if (event.key in usersInfo) {
                    usersInfo[event.key].$destroy();
                    delete usersInfo[event.key];
                }
            }

            makeSelectionTable();
        };
        
        meetUsersArray.$watch(meetUsersEventHandler);

        refs.users.on('child_changed', function(userSnap) {
            // our user changed ?
            if (userSnap.exists() && usersInfo[userSnap.key()]) {
                $scope.$evalAsync(function() {
                    makeSelectionTable();
                });
            }
        });

        refs.users.on('child_removed', function(userSnap) {
            var key = userSnap.key();
            var record = meetUsersArray.$getRecord(key);
            meetUsersArray.$remove(record);
        });

    }]);

    mmhApp.run(['$rootScope', 'userService', 'sessionService', function($rootScope, userService, sessionService) {
        sessionService.init();
    }]);
})();
