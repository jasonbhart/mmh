;(function() {
    'use strict';

    var firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';

    var mmhApp = angular.module('mmh', ['firebase']);

    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null){
                return null;
        }
        else{
                return results[1] || 0;
        }
    };

    mmhApp.controller('main', ['$scope', '$q', '$window', '$firebaseObject', '$firebaseArray',
                        function($scope, $q, $window, $firebaseObject, $firebaseArray) {

        $scope.identity = {
            id: 0, //Math.abs(Math.round(Math.random() * Math.pow(2, 32))),           // random uid
            name: 'Anonymous',
            logged: false
        };

        $scope.$watch('identity.id', function(newVal, oldVal) {
            // remove anonymous user
            if (oldVal == 0 && refs.user) {
                refs.user.orderByChild('id').equalTo(0).once('value', function(userSnap) {
                    userSnap.ref().remove();
                });
            }
            loadCurrentUser();
        });

        $window.fbAsyncInit = function() {
            $window.FB.init({
                    appId      : '450586198440716',
                    cookie     : true,  // enable cookies to allow the server to access
                                                            // the session
                    xfbml      : true,  // parse social plugins on this page
                    version    : 'v2.2', // use version 2.2
                    status     : true       // get user login status asap
            });

            $window.FB.Event.subscribe('auth.authResponseChange', function(response) {
                if (response.status == 'connected' && response.authResponse) {
                    $window.FB.api('/me', function(response) {
                        // set identity
                        $scope.identity.id = response.id;
                        $scope.identity.name = response.name;
                        $scope.identity.logged = true;
                        $scope.identity.pictureUrl = '//graph.facebook.com/' + response.id + '/picture?width=100&height=100'
                        $scope.$apply();
                    });
                }
            });
        };
        (function(d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) return;
                js = d.createElement(s); js.id = id;
                js.src = "//connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));

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

        function loadCurrentUser() {
            // init/load user
            refs.users.orderByChild('id').equalTo($scope.identity.id).once('value', function(userSnap) {
                if (!userSnap.exists()) {
                    refs.user = refs.users.push({ id: $scope.identity.id, name: $scope.identity.name });
                } else {
                    var val = userSnap.val();
                    var id = Object.keys(val)[0];
                    refs.user = userSnap.ref().child(id);
                }

                refs.userPlaces = refs.user.child('places');
                refs.userTimes = refs.user.child('times');
                
                makeSelectionTable();
            });
        }

        loadCurrentUser();
                            
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
            if (event.event == 'child_added' || event.event == 'child_removed' || event.event == 'child_changed') {
                makeSelectionTable();
            }
        });
    }]);
})();
