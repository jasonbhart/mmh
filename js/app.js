;(function() {
    'use strict';

    var firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';

    var mmhApp = angular.module('mmh', ['ngCookies','firebase', 'dateTimePicker']);
    
    mmhApp.filter('stripUrlSchema', function() {
        return function(input) {
            return (input || '').replace(/^\w+\:\/\//, '//');
        }
    });

    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null){
                return null;
        }
        else{
                return results[1] || 0;
        }
    };

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
        console.log('userSnap1', srcUserSnap1.toString());
        console.log('userSnap2', dstUserSnap2.toString());

        var srcUser1 = srcUserSnap1.val();
        var dstUser2 = dstUserSnap2.val() || {};
        var dstUserRef = dstUserSnap2.ref();

        console.log('dstUserRef', dstUserRef);

        var newWhere = getObjectValuesDiff(srcUser1.where, dstUser2.where);
        console.log('newWhere', newWhere);
        var whereRef = dstUserRef.child('where');
        for (var i=0; i<newWhere.length; i++) {
            whereRef.push(newWhere[i]);
        }

        var newWhen = getObjectValuesDiff(srcUser1.when, dstUser2.when);
        console.log('newWhen', newWhen);
        var whenRef = dstUserRef.child('when');
        for (var i=0; i<newWhen.length; i++) {
            whenRef.push(newWhen[i]);
        }

        console.log('mergeUserDataBySnapshots: done');
    }

    mmhApp.controller('main', ['$scope', '$q', '$window', '$log', '$cookies', '$firebaseObject', '$firebaseArray',
                        function($scope, $q, $window, $log, $cookies, $firebaseObject, $firebaseArray) {

        $window.fbo = $firebaseObject;
        $window.fba = $firebaseArray;

        var anonymousIdCookie = 'anonymousId';
        var USER_TYPE_ANONYMOUS = 1;
        var USER_TYPE_FACEBOOK = 2;
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
        if ($.urlParam('meet')) {
            meetId = $.urlParam('meet');
        } else {
            var postIdRef = refs.meet.push({
                'name': 'New Meetup'
            });

            meetId = postIdRef.key();
            isNew = true;
        }

        refs.meet = refs.meet.child(meetId);
        refs.suggestions = new Firebase(firebaseUrl + '/suggestions/' + meetId);
        refs.users = new Firebase(firebaseUrl + '/users');
        refs.meetUsers = refs.meet.child('users');
        refs.meetWhen = refs.meet.child('when');
        
        var meetWhenArray = $firebaseArray(refs.meetWhen);

        // add when
        var dateObject = new Date();
        var newWhen = generateHours(dateObject, 3);
        for (var i=0; i<newWhen.length; i++) {
            toggleMeetWhen(newWhen[i], true);
        }

        // watch identity changes
        $scope.$watch('identity', function(newVal, oldVal) {
            console.log('watch', newVal, oldVal);

            if (oldVal.id !== newVal.id) {

                // merge user's meet data and remove anonymous user
                if (oldVal.id !== undefined && oldVal.logged === false) {
                    console.log('before remove anonymous user', oldVal.id);
                    
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

                            console.log('merge', meetAnonSnap.ref().toString(), meetUserSnap.ref().toString());
                            mergeUserDataBySnapshots(meetAnonSnap, meetUserSnap);
                            
                            console.log('removing anonymous user', meetAnonRef.toString());
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
                console.log('auth.statusChanged', response);

                // somewhy it happens twice
                if (authResponse.status == response.status && authResponse.authResponse == response.authResponse)
                    return;
                
                authResponse = response;
                
                console.log('auth.statusChanged after');

                if (response.status == 'connected' && response.authResponse) {
                    $window.FB.api('/me', function(response) {
                        console.log('Facebook: /me', response.id);
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
                                console.log('FB user exists', response.id);
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
                js.src = "//connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));

        $scope.getProfilePictureUrl = function(user) {
            if (user.facebookid)
                return '//graph.facebook.com/' + user.facebookid + '/picture?width=100&height=100';
            return null;
        }

        function generateHours(date, number) {
            var hours = [];
            var m = new moment(date).minutes(0).seconds(0).milliseconds(0);
            
            for (var i=1; i<=number; i++) {
                m.add(1, 'hour');
                hours.push(m.clone());
            }

            return hours;
        }

        function createAnonymousUser(onComplete) {
            console.log('createAnonymousUser');
            createUser({
                name: 'Anonymous',
                logged: false
            }, function(ref) {
                console.log('createAnonymousUser: ', ref.toString());
                ref.update({ anonymousid: ref.key() }, function() {
                    onComplete(ref.key());
                });
            });
        }

        function createUser(user, onComplete) {
            var ref = refs.users.push(user, function() {
                console.log('createUser: ', ref.toString());
                ref.update({
                    id: ref.key()
                }, function() {
                    onComplete(ref)
                });
            });
        }
 
        function changeUser(userId, userType) {
            console.log('Change user: begin ', userId);
            refs.users.orderByChild('id').equalTo(userId).once('value', function(userSnap) {
                if (!userSnap.exists())
                    return;

                var val = userSnap.val();
                var key = Object.keys(val)[0];
                var user = val[key];

                console.log('changeUser: found', user.id);
                
                // load identity
                $scope.identity.id = user.id;
                $scope.identity.name = user.name;
                $scope.identity.logged = user.logged;
                $scope.identity.userType = userType;

                $scope.$apply();
            });
        }
                            
        function initUser() {
            console.log('initUser');

            var id = $scope.identity.id;

            function onInitialized() {
            }

            refs.meetUser = refs.meetUsers.child(id);

            // add current user to the current meeting
            refs.meetUser.once('value', function(userSnap) {
                console.log('initUser: meetId - ' + meetId.toString() + ', userId - ' + id.toString());
                refs.meetUser.update({joined: true});
                refs.userWhere = refs.meetUser.child('where');
                refs.userWhen = refs.meetUser.child('when');
                makeSelectionTable();
            });
        }

        var meetUsersArray = $firebaseArray(refs.meetUsers);
        

        $scope.shareUrl = 'https://radiant-heat-9175.firebaseapp.com?meet=' + meetId;
        $scope.suggestions = $firebaseArray(refs.suggestions);
        var usersInfo = {};      // user's name, status etc.
        $scope.selectionTable = [];


        // load suggestions
        if (isNew) {
            // get suggestions
            $.getJSON('https://edgeprod.com:8081/', function(data) {
                var businessNames = Object.keys(data.businesses).map(function (key) { return data.businesses[key].name; });
                var businessUrls = Object.keys(data.businesses).map(function (key) { return data.businesses[key].url; });
                var businessRatingUrls = Object.keys(data.businesses).map(function (key) { return data.businesses[key].rating_img_url; });

                // initialize suggestions
                var savedSuggestions = [];
                businessNames.forEach(function(e, i) {
                    var defer = $q.defer();
                    savedSuggestions.push(defer.promise);
                    refs.suggestions.push({
                            'name': businessNames[i],
                            'url': businessUrls[i],
                            'rating_url': businessRatingUrls[i]
                    }, function() {
                        defer.resolve(true);
                    });
                });
                
                $q.all(savedSuggestions).then(function() {
                    $scope.suggestions = $firebaseArray(refs.suggestions);
                });
            });
        } else {
            $scope.suggestions = $firebaseArray(refs.suggestions);
        }

        // helpers
        function makeSelectionTable() {
            console.log('makeSelectionTable', $scope.suggestions, meetUsersArray, meetUsersArray.length, usersInfo);

            var data = {
                user: null,
                others: []
            };

            var availableWhere = _.filter($scope.suggestions, function(sugg) {
                return sugg.suggested;
            });

            // convert datetime to local
            var availableWhen = _.map(meetWhenArray, function(when) {
                return {
                    id: when.$id,
                    when: moment.utc(when.$value).local()
                }
            }).sort(function(a, b) {
                if (a.when < b.when)
                    return -1;
                else if (a.when > b.when)
                    return 1;
                return 0;
            });
            
            // join meet users with selected suggestions
            meetUsersArray.forEach(function(meetUser) {

                // meeting user record doesn't have related user
                if (!usersInfo[meetUser.$id]) {
                    console.log(meetUser.$id.toString() + ' doesn\'t have user info');
                    return;
                }

                var selectedWhere = _.invert(meetUser.where);
                var selectedWhen = _.invert(meetUser.when);
                       
                var record = {
                    user: usersInfo[meetUser.$id],
                    where: [],
                    when: []
                };

                // fill when
                for (var i=0; i<availableWhen.length; i++) {
                    var when = availableWhen[i];
                    record.when.push({
                        whenId: when.id,
                        when: when.when.format($scope.timeFormat),
                        selected: when.id in selectedWhen
                    });
                }

                // fill where
                availableWhere.forEach(function(sugg) {
                    record.where.push({
                        suggestionId: sugg.$id,
                        suggestion: sugg,
                        selectionId: sugg.$id in selectedWhere ? selectedWhere[sugg.$id] : null
                    });
                });

                if (record.user.id == $scope.identity.id)
                    data.user = record;
                else
                    data.others.push(record);      
            });
            
            $scope.selectionTable = data;
        }

        function toggleWhere(meetUserRef, suggestionId, state) {
            meetUserRef
                .child('where')
                    .orderByValue()
                    .equalTo(suggestionId)
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
                    snap.ref().push(suggestionId);
                }
            });
        }

        function toggleMeetWhen(whenMoment, state) {
            var defer = $q.defer();

            // save datetime in UTC
            whenMoment = whenMoment.clone().utc().toISOString();

            refs.meetWhen
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
                }
            });
            
            return defer.promise;
        }

        function toggleWhen(meetUserRef, whenId, state) {
            meetUserRef
                .child('when')
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
        }

        // handlers
        // mark/unmark suggestion as suggested
        $scope.addSuggestion = function(suggestion) {
            var ref = refs.suggestions.child(suggestion.$id);
            ref.update({ suggested: true }, function() {
                // select suggestion by user
                toggleWhere(refs.meetUser, suggestion.$id, true);
            });
        }

        // selection/deselection of place by user
        $scope.selectWhere = function(user, where) {
            if (user.id != $scope.identity.id)
                return;

            toggleWhere(refs.meetUser, where.suggestionId);
        }

        $scope.addWhen = function(whenMoment) {
            toggleMeetWhen(whenMoment, true).then(function(whenId) {
//                toggleWhen(refs.meetUser, whenId, true);
            });
        }

        $scope.selectWhen = function(whenId) {
            toggleWhen(refs.meetUser, whenId);
        }

        // watch for where changes
        $scope.suggestions.$watch(function(event) {
//            console.log('suggestions', event);
            if (event.event == 'child_added' || event.event == 'child_removed' || event.event == 'child_changed') {
                makeSelectionTable();
            }
        });

        meetWhenArray.$watch(function(event) {
            makeSelectionTable();
        });


        // watch for meet users changes
        var meetUsersEventHandler = function(event) {
            console.log('user watch', event, _.cloneDeep(meetUsersArray));
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

        refs.users.on('child_removed', function(userSnap) {
            var key = userSnap.key();
            var record = meetUsersArray.$getRecord(key);
            meetUsersArray.$remove(record);
        });

    }]);
})();
