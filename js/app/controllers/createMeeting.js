;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation) {
        $scope.MAX_STAGE = 5;
        $scope.stage = 1; 
        $scope.what = 'restaurants';
        $scope.when = 1;
        $scope.where = 1;
        $scope.establishment = 'other';
        $scope.publish = 1;
        $scope.terms = dataProvider.getTerms();
        $scope.term = 'restaurants';
        $scope.suggestions = {};
        $scope.timeFormat = 'h:mmA';
        $scope.times = [];
        
        $scope.next = function() {
            // test create meeting, will move to finish later
            //($scope.stage != 1) || createMeeting();
            if ($scope.stage === 3) {
                var options = {
                    'term' : ($scope.what !== 'other') ? $scope.what : $scope.term,
                    'sort' : '2',
                    'limit': '3'
                };
                
                if ($scope.where !== 'other') {
                    var currentLocation = geoLocation.getLocation();
                    currentLocation.then(function(position) {
                        if (position.coords.latitude && position.coords.longitude) {
//                            options.coords = {lat: position.coords.latitude, lng: position.coords.longitude};
                            // Boston location for testing purpose
                            options.coords = {lat: '42.3133735', lng: '-71.0571571,12'};
                        }
                    }, function() {
                        $log.log('Can not find current location');
                    });
                    
                    options.radius = dataProvider.convertMilesToKms($scope.where);
                } else {
                    options.location = $scope.other_location;
                }
                
                setTimeout(function(){
                    dataProvider.getSuggestions(options).then(function(suggestions) {
                        $scope.suggestions = suggestions;
                    });
                }, 1000);
                
            }
            
            $scope.stage ++;
        };
        
        $scope.back = function() {
            if ($scope.stage > 1) {
                $scope.stage --;
            }  
        };
        
        $scope.finish = function() {
            alert('finish');
        };
        
        $scope.getVisitedStatus = function (elementIndex) {
            if (elementIndex < $scope.stage) {
                return 'visited';
            } else if (elementIndex == $scope.stage) {
                return 'active';
            } else if (elementIndex == $scope.stage + 1) {
                return 'next';
            } else {
                return '';
            }
        };
        
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
        
        // formatted data
        $scope.usersInfo = {
            currentId: null,
            current: null,
            others: {},
            all: {},
            othersCount: 0,
            add: function(id, info) {
                this.all[id] = info;
                if (id == this.currentId) {
                    this.current = info;
                } else {
                    this.others[id] = info;
                    this.othersCount++;
                }
            },
            remove: function(id) {
                if (id == this.currentId) {
                    this.current = null;
                    this.currentId = null;
                }
                
                delete this.others[id];
                this.othersCount--;
                delete this.all[id];
            },
            setCurrentId: function(id) {
                if (id == this.currentId)
                    return;

                if (this.currentId !== null && this.current) {
                    this.others[this.currentId] = this.current;
                    this.othersCount++;
                }
                
                this.current = this.others[id];
                delete this.others[id];
                this.othersCount--;
                this.currentId = id;
            }
        };
        
        var timesProvider = {
            getTimes: function() {
                return $scope.times;
            },
            format: function(time) {
                return time.format($scope.timeFormat);
            }
        };
        
        $scope.addTimes = function() {
            var dialog = dialogs.userMeetingTimes(timesProvider);
            dialog.result.then(function(times) {
                $log.log('Show times result:', times);
                $scope.times = times;
            });
        };
        
        $scope.removeTime = function (time) {
            _.remove($scope.times, function(t) {
                return t.isSame(time);
            });   
        };
        
        $scope.$watch('when', function (newValue, oldValue) {
            if (newValue === 'one_hour_later') {
                $scope.times = [moment().add(1, 'hours').startOf('hour')]
            } else if (newValue === 'two_hours_later') {
                 $scope.times = [moment().add(2, 'hours').startOf('hour')]
            } else if (newValue === 'four_hours_later') {
                 $scope.times = [moment().add(4, 'hours').startOf('hour')]
            } else if (newValue === 'other') {
                $scope.addTimes();
            }
        });
        
        var createMeeting = function() {
            var data = {
                name: $scope.meeting_name,
                createdDate: moment().utc().toISOString()
            };
            var meetingPromise = meetingService.create(data);
            meetingPromise.then(function(meeting) {
                var meetingId = meeting.refs.current.key();
                console.log(meetingId);
            });
        };
    }]);
})();