;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('localMeetingService', ['$rootScope', '$q', '$log', 'appConfig',
            function($rootScope, $q, $log, appConfig) {

        var refGEO = new Firebase(appConfig.firebaseUrl + '/localMeetsGEO');
        var localMeetsGEO = new GeoFire(refGEO);
        var localMeets = new Firebase(appConfig.firebaseUrl + '/localMeets');
        
        var service = {
            /**
             * @param {string} meetingId
             * @param {string} whereId
             * @param {Object} location { lat: float, lng: float }
             */
            add: function(meetingId, whereId, location) {
                var ref = localMeets.push({
                    meeting: meetingId,
                    where: whereId
                });
                
                $log.log('localMeetingsService: add key', ref.key());
                return $q.when(localMeetsGEO.set(ref.key(), [location.lat, location.lng]));
            },
            /**
             * @param {string} meetingId
             * @param {string} whereId
             */
            remove: function(meetingId, whereId) {
                var key = getKey(meetingId, whereId);
                $log.log('localMeetingsService: remove key', key);
                return $q.when(localMeetsGEO.remove(key));
            },
            /**
             * 
             * @param {Object} center { lat: float, lng: float }
             * @param {float} radius in km
             * @returns {promise}
             */
            search: function(center, radius, limit) {
                var defer = $q.defer();
                var deferreds = [];
                var ids = {};
                var query = localMeetsGEO.query({
                    center: [center.lat, center.lng],
                    radius: radius
                });

                query.on('ready', function() {
                    // wait for all meetings
                    $rootScope.$applyAsync(function() {
                        $q.all(deferreds).then(function(meetings) {
                            meetings = _.filter(meetings);                  // filter out empty values produces by resolve()
                            defer.resolve(meetings.slice(0, limit));        // we can have more than limit because of deferreds
                        });
                    });
                    query.cancel();
                });

                query.on('key_entered', function(key, location, distance) {
                    if (_.keys(ids).length >= limit)
                        return;

                    var meetDefer = $q.defer();
                    deferreds.push(meetDefer.promise);

                    localMeets.child(key).once('value', function(snap) {
                        if (!snap.exists()) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }
                        
                        var value = snap.val();

                        // we already know about this meeting
                        if (ids[value.meeting]) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }

                        ids[value.meeting] = true;
                        var meeting = {
                            meetingId: value.meeting,
                            whereId: value.where,
                            location: location,
                            distance: distance
                        };
                        
                        $rootScope.$applyAsync(function() {
                            meetDefer.resolve(meeting);
                        });
                    });
                });
                
                return defer.promise;
            }
        };

        return service;
    }]);
})();