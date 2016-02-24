;
(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('googleMap',
    ['$rootScope', '$document', 'util',
    function($rootScope, $document, util) {
        return {
            drawMap: function(rootElement, initialPosition, radius) {
                var mapOptions = {
                    zoom: 10,
                    panControl: true,
                    zoomControl: true,
                    scaleControl: true
                };

                var searchBox = rootElement.find('.search-box').get(0);
                var mapElement = rootElement.find('.map-canvas').get(0);

                // create map
                var map = new google.maps.Map(mapElement, mapOptions);
               // map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchBox);

                // google maps changes position object, so we want to pass a copy of it
                var position = new google.maps.LatLng(initialPosition.lat, initialPosition.lng);
                map.setCenter(position);

                // add autocomplete
                var autocomplete = new google.maps.places.Autocomplete(searchBox);
                autocomplete.setTypes(['address']);

                var marker = new google.maps.Marker({
                    position: position,
                    map: map,
                    draggable: true
                });

                var area = new google.maps.Circle({
                    strokeColor: '#5555AA',
                    strokeOpacity: 1,
                    strokeWeight: 2,
                    fillColor: '#5555AA',
                    fillOpacity: 0.35,
                    center: position,
                    radius: getAreaRadius(radius),
                    map: map,
                    geodesic: true
                });

                // center map/move marker when user searches for location
                google.maps.event.addListener(autocomplete, 'place_changed', function() {
                    area.setVisible(false);
                    marker.setVisible(false);

                    var place = autocomplete.getPlace();
                    if (!place.geometry) {
                        return;
                    }

                    map.setCenter(place.geometry.location);
                    area.setCenter(place.geometry.location);
                    marker.setPosition(place.geometry.location);
                    marker.setVisible(true);
                    area.setVisible(true);

                    saveCurrentPosition(place.geometry.location, radius);
                });

                // on marker drag
                google.maps.event.addListener(marker, 'drag', function(e) {
                    saveCurrentPosition(e.latLng, radius);
                    area.setCenter(e.latLng);
                });

                // trigger map resizing to adjust size after loading (we have dynamically sized workarea)
                google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
                    google.maps.event.trigger(map, 'resize');
                });
                
                this.setCenter = function (lat, lng) {
                    var position = new google.maps.LatLng(lat, lng);
                    map.setCenter(position);
                    marker.setPosition(position);
                }
                
                return this;

            },
            makeAutoComplete : function(inputClass) {
                var searchBox = $('.' + inputClass).get(0);
                var autocomplete = new google.maps.places.Autocomplete(searchBox);
                autocomplete.setTypes(['address']);
                google.maps.event.addListener(autocomplete, 'place_changed', function() {
                    $rootScope.$broadcast('position.changed', {});
                });
            }
        };
        
        function saveCurrentPosition(position, radius) {
            var newPosition = {
                    position: {
                        lat: position.lat(),
                        lng: position.lng(),
                    },
                    radius: radius
                };
            $rootScope.$broadcast('position.changed', newPosition);
        }
        
        function getAreaRadius(radiusInMiles) {
            return util.convertMilesToKms(radiusInMiles) * 1000;
        }
    }]);
})();
