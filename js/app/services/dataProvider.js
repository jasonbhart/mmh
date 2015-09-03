;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('dataProvider', ['$q', '$http', '$log', 'appConfig', function($q, $http, $log, appConfig) {
        return {
            convertMilesToKms: function(miles) {
                return miles * 1.609344;
            },
            
            getTerms: function() {
                return [
                    { id: 'restaurants', name: 'Restaurants' },
                    { id: 'food', name: 'Food' },
                    { id: 'nightlife', name: 'Nightlife' },
                    { id: 'shopping', name: 'Shopping' },
                    { id: 'bars', name: 'Bars' },
                    { id: 'american-new', name: 'American (New)' },
                    { id: 'breakfast-brunch', name: 'Breakfast & Brunch' },
                    { id: 'coffee-tea', name: 'Coffee & Tea' },
                    { id: 'beauty-spas', name: 'Beauty & Spas' },
                    { id: 'health-medical', name: 'Health & Medical' },
                    { id: 'home-services', name: 'Home Services' },
                    { id: 'automotive', name: 'Automotive' },
                    { id: 'local-services', name: 'Local Services' },
                    { id: 'event-services', name: 'Event Planning & Services' },
                    { id: 'arts-entertainment', name: 'Arts & Entertainment' },
                    { id: 'active-life', name: 'Active Life' },
                    { id: 'hotels-travel', name: 'Hotels & Travel' },
                    { id: 'pets', name: 'Pets' },
                    { id: 'professional-services', name: 'Professional Services' },
                    { id: 'local-flavor', name: 'Local Flavor' },
                    { id: 'education', name: 'Education' },
                    { id: 'public-government', name: 'Public Services & Government' },
                    { id: 'real-estate', name: 'Real Estate' },
                    { id: 'financial-services', name: 'Financial Services' },
                    { id: 'mass-media', name: 'Mass Media' },
                    { id: 'religious-organizations', name: 'Religious Organizations' }
                ];
            },
            
            /*
             * options = {
             *  location: "location name",
             *  OR
             *  coords: {
             *      lat: number,
             *      lng: number
             *  },
             *  
             *  radius: "number in kms"
             * }
             */
            getSuggestions: function(options) {
                var searchOptions = {};

                if (options) {
                    // location
                    if (options.location) {
                        searchOptions.location = options.location;
                    } else if (options.coords) {
                        searchOptions.coords = options.coords.lat + ',' + options.coords.lng;
                    }

                    // search radius
                    if (options.radius) {
                        // convert to meters
                        searchOptions.radius = options.radius * 1000;
                    }
                    
                    searchOptions.term = options.term || 'restaurants';
                    // search offset, default 0.
                    if (options.offset) {
                        searchOptions.offset = options.offset;
                    }
                    // search limit - number of fetch items upon cliking show more
                    if (options.limit) {
                        searchOptions.limit = options.limit;
                    }
                }
                
                $log.log('dataProvider: getSuggestions: searchOptions', searchOptions);

                var defer = $q.defer();
                $http.get(appConfig.dataUrl, { params: searchOptions }).then(function(response) {
                    var data = response.data;
                    if (!data) {
                        defer.reject('Empty response');
                        return;
                    }

                    // TODO:
                    if (typeof(data) == 'string') {
                        try {
                            data = JSON.parse(data);
                            if (data.error && data.error.text)
                                defer.reject(data.error.text);
                            else
                                defer.reject('Unknown error');
                        } catch(e) {
                            defer.reject('Invalid response');
                        }

                        return;
                    }

                    // initialize suggestions
                    // TODO: move this onto nodejs side
                    var suggestions = [];
                    _.forEach(data.businesses, function(buss) {
                        var suggestion = {
                            'type': searchOptions.term,
                            'name': buss.name,
                            'url': buss.url,
                            'rating_url': buss.rating_img_url,          // TODO: do we use this ?
                            'rating': buss.rating,
                            'image_url': buss.image_url,
                            'display_address': buss.location.display_address,   // TODO: move this into location
                            'city': buss.location.city,                         //
                            'country_code': buss.location.country_code,         //
                            'location': {
                                'display_address': buss.location.display_address[0] + ', ' + buss.location.display_address[2],
                                'coordinate': {
                                    lat: buss.location.coordinate.latitude,
                                    lng: buss.location.coordinate.longitude
                                }
                            }
                        };

                        if (buss.distance)
                          suggestion.distance = buss.distance;
                      
                        suggestions.push(suggestion);
                    });

                    defer.resolve(suggestions);
                }, function(response) {
                    $log.log('mmh.services:dataProvider:getSuggestions failed', response.status, response.statusText);
                    defer.reject(response.statusText);
                });
                
                return defer.promise;
            }
        };
    }]);
})();
