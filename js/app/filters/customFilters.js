var app = angular.module('customFilters', []);
app.filter('escape', function() {
  return window.encodeURIComponent;
});