;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('localMeetings', ['localMeetingsInfo', 'util', function(localMeetingsInfo, util) {
        return {
            restrict: 'E',
            scope: {
                excludeMeeting: '@',
                location: '=',
                radius: '=',
                count: '@'
            },
            templateUrl: 'js/app/tmpl/localMeetings.html',
            link: function(scope, element, attrs) {
                // for example we want 3 results but it is impossible to exclude current meeting from the search,
                // so +1 and we will exclude it manually
                scope.count++;

                scope.meetings = [];

                scope.$watchGroup(['location', 'radius', 'excludeMeeting'], function(values) {
                    if (!values[0] || !values[1])
                        return;

                    localMeetingsInfo
                        .get({
                            coord: scope.location,
                            radius: util.convertMilesToKms(scope.radius),
                            count: scope.count,
                            exclude: [scope.excludeMeeting]
                        })
                        .then(function(results) {
                            scope.meetings = results;
                        });
                });
            }
        };
    }]);
})();
