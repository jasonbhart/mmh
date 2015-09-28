;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('dialogs', ['modal',
            function(modal) {
        return {
            userMeetingPlaces: function(placesProvider) {
                return modal.open({
                    templateUrl: 'js/app/tmpl/userMeetingPlaces.html',
                    controller: 'UserMeetingPlacesController',
                    resolve: {
                        placesProvider: placesProvider
                    }
                });
            },
            userMeetingTimes: function(timesProvider) {
                return modal.open({
                    templateUrl: 'js/app/tmpl/userMeetingTimes.html?v=2',
                    controller: 'UserMeetingTimesController',
                    resolve: {
                        timesProvider: timesProvider
                    }
                });
            },

            /*
             * @type location {position: {lat: X, lng: Y}, radius: R}
             */
            locationMap: function(location) {
                return modal.open({
                    templateUrl: 'js/app/tmpl/locationMap.html?v=2',
                    controller: 'LocationMapController',
                    resolve: {
                        location: location
                    }
                });
            },
            
            auth: function() {
                return modal.open({
                    templateUrl: 'js/app/tmpl/authModal.html',
                    controller: 'AuthModalController'
                });
            },
            
            addManualBusiness: function(business) {
                return modal.open({
                    templateUrl: 'js/app/tmpl/manualBusiness.html',
                    controller: 'ManualBusinessController',
                    resolve: {
                        business: business
                    }
                });
            }
        }
     }]);
})();
