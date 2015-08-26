var app = angular.module('customFilters', []);
app.filter('escape', ['$window', function($window) {
  return $window.encodeURIComponent;
}]);