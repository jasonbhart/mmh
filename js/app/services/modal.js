;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('modal', ['$rootScope', '$templateRequest', '$q', '$compile', '$controller', '$document', '$log',
            function($rootScope, $templateRequest, $q, $compile, $controller, $document, $log) {
        return {
            // opens (creates) new modal
            open: function(options) {
                var modalTemplatePromise = $templateRequest(options.templateUrl);

                var resultDefered = $q.defer();
                var openDefered = $q.defer();
                var renderDefered = $q.defer();
                var onModalClose = function() {};
                
                var modalInstance = {
                    result: resultDefered.promise,
                    opened: openDefered.promise,
                    rendered: renderDefered.promise,
                    close: function(result) {
                        onModalClose();
                        resultDefered.resolve(result);
                    },
                    dismiss: function(reason) {
                        onModalClose();
                        resultDefered.reject(reason);
                    }
                };

                // wait for a template
                modalTemplatePromise.then(function(modalTemplate) {
                    var scope = $rootScope.$new(true);
                    var modalElement = $compile(modalTemplate)(scope);

                    onModalClose = function() {
                        modalElement.closeModal({
                            complete: function() {
                                scope.$destroy();
                            }
                        });
                    }

                    $document.find('body').append(modalElement);
                    
                    scope.$on('$destroy', function() {
                        modalElement.closeModal();
                        modalElement.remove();
                    });

                    // open modal
                    modalElement.openModal({
                        ready: function() {
                            renderDefered.resolve(modalElement);
                        },
                        complete: function() {
                            resultDefered.reject('dismissed');
                            scope.$destroy();
                        }
                    });

                    // controller locals
                    var ctrlLocals = angular.extend(
                        options.resolve || {},
                        { $scope: scope, modalInstance: modalInstance }
                    );

                    // create controller
                    $controller(options.controller, ctrlLocals);
                });

                // open deffered
                modalTemplatePromise.then(function() {
                    openDefered.resolve(true);
                }, function(reason) {
                    openDefered.reject(reason);
                });
                
                modalInstance.result.then(function() {
                }, function() {
                });

                return modalInstance;
            }
        } 
     }]);
})();
