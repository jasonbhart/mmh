;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('localMeetingsInfo', ['$q', '$log', 'dataProvider', 'meetingService', 'localMeetingService',
            function($q, $log, dataProvider, meetingService, localMeetingService) {

        var types = {};
        _.forEach(dataProvider.getTerms(), function(term) {
            types[term.id] = term.name;
        });

        return {
            /**
             * Returns information about [count] local meetings [coord, radius] excluding ids [exclude]
             * @param {Object} options {coord: {lat: float, lng: float}, radius: (in km), count: int, exclude: []}
             * @returns {promise}
             */
            get: function(options) {
                var defer = $q.defer();

                localMeetingService.search(options)
                        .then(function (meetings) {
                    $log.log('localMeetingsInfo: Local events', meetings);
                    if (options.exclude) {
                        meetings = _.filter(meetings, function(meet) {
                            return options.exclude.indexOf(meet.meetingId) == -1;
                        });
                    }

                    // get meetings info
                    meetingService.getInfo(meetings).then(function(meetingsInfo) {
                        var results = _.map(meetingsInfo, function(info) {
                            info.type = types[info.where.type] ? types[info.where.type] : 'Establishement';
                            info.url = meetingService.getSharingUrl(info.id);
                            return info;
                        });

                        defer.resolve(results);
                    });
                });

                return defer.promise;
            }
        };
    }]);
})();
