;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'LocationMapCtrl',
        ['$scope', '$modalInstance', '$document', 'location', 'dataProvider',
        function ($scope, $modalInstance, $document, location, dataProvider) {

        // default position: Boston, MA
        $scope.position = { lat: 42.3133735, lng: -71.0571571 };
        $scope.radius = 1;
        if (location) {
            $scope.position = { lat: location.position.lat, lng: location.position.lng };
            $scope.radius = location.radius;
        }

        $scope.confirm = function () {
            $modalInstance.close({
                position: $scope.position,
                radius: parseInt($scope.radius)
            });
        };

        $scope.cancel = function () {
            $modalInstance.dismiss();
        };

        // reflect radius changes to area radius
        $scope.$watch('radius', function(radius) {
            if (area) {
                area.setRadius(getAreaRadius(radius));
            }
        });
        
        function getAreaRadius(radiusInMiles) {
            return dataProvider.convertMilesToKms(radiusInMiles) * 1000;
        }

        // circle around marker (current position)
        var area = null;

        $modalInstance.rendered.then(function() {
            var mapOptions = {
                zoom: 10,
                panControl: true,
                zoomControl: true,
                scaleControl: true
            };

            var mapElement = $document.find('.location-map-modal .map-canvas').get(0);

            // show map
            var map = new google.maps.Map(mapElement, mapOptions);

            // google maps changes position object, so we want to pass a copy of it
            var position = new google.maps.LatLng($scope.position.lat, $scope.position.lng);

            // trigger map resizing to adjust size after loading (we have dynamically sized workarea)
            google.maps.event.addListenerOnce(map, 'tilesloaded', function(){
                google.maps.event.trigger(map, 'resize');
            });
            map.setCenter(position);

            var marker = new google.maps.Marker({
                position: position,
                map: map,
                draggable: true
            });
            
            area = new google.maps.Circle({
                strokeColor: '#5555AA',
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: '#5555AA',
                fillOpacity: 0.35,
                center: position,
                radius: getAreaRadius($scope.radius),
                map: map,
                geodesic: true
            });

            // marker drag
            google.maps.event.addListener(marker, 'drag', function(e) {
                $scope.$apply(function() {
                    $scope.position = {
                        lat: e.latLng.lat(),
                        lng: e.latLng.lng(),
                    };
                });
                
                area.setCenter(e.latLng);
            });
        });
    }]);
})();
