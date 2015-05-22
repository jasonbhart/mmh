;(function() {
    'use strict';

    var firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';

    var mmhApp = angular.module('mmh', ['ngCookies','firebase']);

    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null){
                return null;
        }
        else{
                return results[1] || 0;
        }
    };

    mmhApp.controller('main', ['$scope', '$q', '$window', '$cookies', '$firebaseObject', '$firebaseArray',
                        function($scope, $q, $window, $cookies, $firebaseObject, $firebaseArray) {

        var anonymousIdCookie = 'anonymousId';
        $scope.identity = {
            id: undefined, //Math.abs(Math.round(Math.random() * Math.pow(2, 32))),           // random uid
            name: undefined,
            logged: false
        };

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

        var availableTimes = [];
        var dateObject = new Date();

        availableTimes = returnHours12(dateObject, 3);

        refs.meet = refs.meet.child(meetId);
        refs.suggestions = new Firebase(firebaseUrl + '/suggestions/' + meetId);
        refs.meetSuggestions = refs.meet.child('suggestions');
        refs.users = refs.meet.child('users');

        // watch identity changes
        $scope.$watch('identity', function(newVal, oldVal) {
            console.log('watch', newVal, oldVal);

            if (oldVal.id !== newVal.id) {
                
                // remove anonymous user
                if (oldVal.id !== undefined && oldVal.logged === false) {
                    console.log('before remove anonymous user', oldVal.id)
                    refs.users.orderByChild('id').equalTo(oldVal.id).once('value', function(userSnap) {
                        if (!userSnap.exists())
                            return;
                        var value = userSnap.val();
                        var id = Object.keys(value)[0];
                        var userRef = userSnap.child(id).ref();
                        console.log('removing anonymous user', userRef.toString());
                        userRef.remove();
                    });
                }

                initUser();
                makeSelectionTable();
            }
        }, true);

        $window.fbAsyncInit = function() {
            $window.FB.init({
                    appId      : '450586198440716',
                    cookie     : true,  // enable cookies to allow the server to access
                                                            // the session
                    xfbml      : true,  // parse social plugins on this page
                    version    : 'v2.2' // use version 2.2
                    //status     : true       // get user login status asap. This works but only if user is logged in
            });

            function fbAuthStatusChange(response) {
                console.log('auth.statusChanged', response);
                
                if (response.status == 'connected' && response.authResponse) {
                    $window.FB.api('/me', function(response) {
                        console.log('Facebook: /me', response.id);
                        // user is authenticated, remove anonymousId cookie
                        delete $cookies[anonymousIdCookie];

                        refs.users.orderByChild('id').equalTo(response.id).once('value', function(snap) {
                            if (!snap.exists()) {
                                createUser({
                                    id: response.id,    // + Math.round(Math.random()*1000).toString();
                                    name: response.name,
                                    logged: true
                                }, function(ref) {
                                    ChangeUser(response.id);
                                });
                            } else {
                                console.log('FB user exists', response.id);
                                ChangeUser(response.id);
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
                        ChangeUser(id);
                    }

                    // check if such anonymous user exists
                    if (id) {
                        refs.users.orderByChild('id').equalTo(id).once('value', function(snap) {
                            // no such user exists for current meeting
                            if (!snap.exists()) {
                                createAnonymousUser(onGetAnonymousUser);
                            } else {
                                // user exists
                                var value = snap.val();
                                value = value[Object.keys(value)[0]];
                                console.log(value);
                                onGetAnonymousUser(value.id);
                            }
                        });
                    } else {
                        // new visit
                        createAnonymousUser(onGetAnonymousUser);
                    }
                }
            }

            $window.FB.Event.subscribe('auth.statusChange', fbAuthStatusChange);    // subscribe for status changes
            $window.FB.getLoginStatus(fbAuthStatusChange);      // need to call this because status in init doesn't work
        };
        (function(d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) return;
                js = d.createElement(s); js.id = id;
                js.src = "//connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));


        function returnHours12(date, number) {
            var hourArray = [];
            var hour = (date.getHours() + 24) % 12 || 12;

            for (var i = 1; i <= number; i++) {
                if ((hour + i) > 12) {
                    var newHour = ((hour + i) - 12) + ':00';
                    newHour += ((date.getHours() + i) >= 12 && (date.getHours() + i) <= 23) ? 'pm' : 'am';
                    hourArray.push(newHour);
                } else {
                    var newHour = (hour + i) + ':00';
                    newHour += ((date.getHours() + i) >= 12 && (date.getHours() + i) <= 23) ? 'pm' : 'am';
                    hourArray.push(newHour);
                }

            }

            return hourArray;
        }

        function createAnonymousUser(onComplete) {
            console.log('createAnonymousUser');
            createUser({
                id: 0,
                name: 'Anonymous',
                logged: false
            }, function(ref) {
                console.log('createAnonymousUser: ', ref.toString());
                var id = 'anonymous' + ref.key();
                ref.update({ id: id }, function() {
                    onComplete(id)
                });
            });
        }

        function createUser(user, onComplete) {
            var ref = refs.users.push({
                id: user.id,
                name: user.name,
                logged: user.logged
            }, function() {
                console.log('createUser: ', ref.toString());
                onComplete(ref);
            });
        }
        
        function ChangeUser(id) {
            console.log('ChangeUser: changing', id);
            refs.users.orderByChild('id').equalTo(id).once('value', function(userSnap) {
                if (!userSnap.exists())
                    return;

                var val = userSnap.val();
                var key = Object.keys(val)[0];
                console.log(key);
                var user = val[key];

                console.log('ChangeUser: found', user.id);

                refs.user = refs.users.child(key);

                // load identity
                $scope.identity.id = user.id;
                $scope.identity.name = user.name;
                $scope.identity.logged = user.logged;

                $scope.$apply();
            });
        }

        function initUser() {
            console.log('initUser');
                            
            refs.userPlaces = refs.user.child('places');
            refs.userTimes = refs.user.child('times');
        }

        var users = $firebaseArray(refs.users);

        $scope.shareUrl = 'https://radiant-heat-9175.firebaseapp.com?meet=' + meetId;
        $scope.suggestions = $firebaseArray(refs.suggestions);
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
            refs.users.once('value', function(usersSnap) {
                // select only those having suggested = true
                refs.suggestions.orderByChild('suggested').equalTo(true).once('value', function(suggSnap) {

                    // at this step users and suggestions are fetched
                    
                    var data = {
                        user: null,
                        others: []
                    };

                    usersSnap.forEach(function(user) {
                        // places selected by user
                        var selectedPlaces = {};
                        var selectedTimes = {};
                        user = user.val();
                        if (!user.name)
                            return;

                        var record = {
                            user: user,
                            places: [],
                            times: []
                        };

                        // collect places selected by user
                        var places = user.places || {};
                        for (var p in places) {
                            if (!places.hasOwnProperty(p))
                                continue;
                            selectedPlaces[places[p]] = p;
                        }

                        var times = user.times || {};
                        for (var t in times) {
                            if (!times.hasOwnProperty(t))
                                continue;
                            selectedTimes[times[t]] = t;
                        }
                        
                        for (var i=0; i<availableTimes.length; i++) {
                            record.times.push({
                                time: availableTimes[i],
                                selectionId: availableTimes[i] in selectedTimes ? selectedTimes[availableTimes[i]] : null
                            });
                        }

                        suggSnap.forEach(function(sugg) {
                            var suggId = sugg.key();
                            record.places.push({
                                suggestionId: sugg.key(),
                                suggestion: sugg.val(),
                                selectionId: suggId in selectedPlaces ? selectedPlaces[suggId] : null
                            });
                        });

                        if (record.user.id == $scope.identity.id)
                            data.user = record;
                        else
                            data.others.push(record);
                    });                    

                    $scope.selectionTable = data;
                });
            });
        }

        // handlers
        // mark/unmark suggestion as suggested
        $scope.addSuggestion = function(suggestion) {
            var ref = refs.suggestions.child(suggestion.$id);
            ref.update({ suggested: true });
        }

        // selection/deselection of place by user
        $scope.selectPlace = function(user, place) {
            if (user.id != $scope.identity.id)
                return;

            if (place.selectionId)
                refs.userPlaces.child(place.selectionId).remove();
            else
                refs.userPlaces.push(place.suggestionId);
        }

        $scope.selectTime = function(time) {
            if (time.selectionId)
                refs.userTimes.child(time.selectionId).remove();
            else
                refs.userTimes.push(time.time);
        }

        // watch for where changes
        $scope.suggestions.$watch(function(event) {
            if (event.event == 'child_added' || event.event == 'child_removed' || event.event == 'child_changed') {
                makeSelectionTable();
            }
        });

        // watch for users changes
        users.$watch(function(event) {
            console.log('user watch', event.event);
            if (event.event == 'child_added' || event.event == 'child_removed' || event.event == 'child_changed') {
                makeSelectionTable();
            }
        });
    }]);
})();
