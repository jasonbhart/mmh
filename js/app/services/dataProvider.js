;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('dataProvider', ['$q', '$http', '$log', 'appConfig', function($q, $http, $log, appConfig) {
        return {
            getTerms: function() {
                return [
                    { id: 'restaurants', name: 'Restaurants' },
                    { id: 'food', name: 'Food' },
                    { id: 'nightlife', name: 'Nightlife' },
                    { id: 'shopping', name: 'Shopping' },
                    { id: 'bars', name: 'Bars' },
                    { id: 'newamerican', name: 'American (New)' },
                    { id: 'breakfast_brunch', name: 'Breakfast & Brunch' },
                    { id: 'coffee', name: 'Coffee & Tea' },
                    { id: 'beautysvc', name: 'Beauty Services & Spas' },
                    { id: 'arts', name: 'Arts & Entertainment' },
                    { id: 'active', name: 'Physical Activities' },
                    { id: 'localflavor', name: 'Local Flavor' },
                ];
            },
            getActivities: function() {
                return [
                    { id: 'restaurants', name: 'Share a meal' },
                    { id: 'bars', name: 'Get a drink'},
                    { id: 'coffee', name: 'Have coffee'},
                    { id: 'nightlife', name: 'Enjoy the nightlife' },
                    { id: 'shopping', name: 'Go shopping' },
                    { id: 'active', name: 'Play sports' },
                    { id: 'arts', name: 'Enjoy the arts' },
                    { id: 'beautysvc', name: 'Pamper yourself' },
                    { id: 'localflavor', name: 'Find local events' },
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
                    
                    // sort result
                    if (options.sort) {
                        searchOptions.sort = options.sort;
                    }
                    
                    //category filter
                    if (options.category_filter) {
                        searchOptions.category_filter = options.category_filter;
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

                    // TODO: do we need this ?
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
                                'display_address': buss.location.display_address.join(', '),
                                'coordinate': {
                                    lat: buss.location.coordinate.latitude,
                                    lng: buss.location.coordinate.longitude
                                }
                            },
                            'categories': buss.categories
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
