'use strict';

module.exports = function() {
  return {
    addDocumentationToApiGateway: function addDocumentationToApiGateway(resource, documentationPart, mapPath) {
      if (documentationPart && Object.keys(documentationPart).length > 0) {
        if (!resource.Properties.RequestParameters) {
          resource.Properties.RequestParameters = {};
        }

        documentationPart.forEach(function(qp) {
          const source = `method.request.${mapPath}.${qp.name}`;
          if (resource.Properties.RequestParameters.hasOwnProperty(source)) return; // don't mess with existing config
          resource.Properties.RequestParameters[source] = qp.required || false;
        });
      }
    },

    updateCfTemplateFromHttp: function updateCfTemplateFromHttp(eventTypes) {
      if (eventTypes.http && eventTypes.http.documentation) {
        const resourceName = this.normalizePath(eventTypes.http.path);
        const methodLogicalId = this.getMethodLogicalId(resourceName, eventTypes.http.method);
        const resource = this.cfTemplate.Resources[methodLogicalId];

        resource.DependsOn = new Set();
        this.addMethodResponses(resource, eventTypes.http.documentation);
        this.addRequestModels(resource, eventTypes.http.documentation);
        if (!this.options['doc-safe-mode']) {
          this.addDocumentationToApiGateway(
            resource,
            eventTypes.http.documentation.requestHeaders,
            'header'
          );
          this.addDocumentationToApiGateway(
            resource,
            eventTypes.http.documentation.queryParams,
            'querystring'
          );
          this.addDocumentationToApiGateway(
            resource,
            eventTypes.http.documentation.pathParams,
            'path'
          );
        }
        resource.DependsOn = Array.from(resource.DependsOn);
        if (resource.DependsOn.length === 0) {
          delete resource.DependsOn;
        }
      }
    },
  };
};
