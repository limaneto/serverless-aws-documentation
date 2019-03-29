'use strict';
const documentation = require('./documentation');
const models = require('./models');

class ServerlessAWSDocumentation {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = 'aws';

    Object.assign(this, models);
    Object.assign(this, documentation());

    this.customVars = this.serverless.variables.service.custom;
    const naming = this.serverless.providers.aws.naming;
    this.getMethodLogicalId = naming.getMethodLogicalId.bind(naming);
    this.normalizePath = naming.normalizePath.bind(naming);

    this._beforeDeploy = this.beforeDeploy.bind(this);

    this.hooks = {
      'before:package:finalize': this._beforeDeploy
    };

    this.documentationParts = [];
  }

  hasFunctionDocumentation(event) {
    if (event.http && event.http.documentation) {
      this.customVars.hasFunctionDocumentation = true;
    }
  }

  beforeDeploy() {
    this.customVars = this.serverless.variables.service.custom || {};
    const functions = this.serverless.service.getAllFunctions();
    functions.forEach(functionName => {
      const func = this.serverless.service.getFunction(functionName);
      func.events.forEach(this.hasFunctionDocumentation.bind(this));
    });

    if (!this.customVars.models && !this.customVars.hasFunctionDocumentation) return;

    this.cfTemplate = this.serverless.service.provider.compiledCloudFormationTemplate;

    // The default rest API reference
    let restApiId = {
      Ref: 'ApiGatewayRestApi',
    };

    // Use the provider API gateway if one has been provided.
    if (this.serverless.service.provider.apiGateway && this.serverless.service.provider.apiGateway.restApiId) {
      restApiId = this.serverless.service.provider.apiGateway.restApiId
    }

    if (this.customVars.models) {
      const cfModelCreator = this.createCfModel(restApiId);

      // Add model resources
      const models = this.customVars.models.map(cfModelCreator)
        .reduce((modelObj, model) => {
          modelObj[`${model.Properties.Name}Model`] = model;
          return modelObj;
        }, {});
      Object.assign(this.cfTemplate.Resources, models);
    }

    // Add models to method resources
    functions.forEach(functionName => {
      const func = this.serverless.service.getFunction(functionName);
      func.events.forEach(this.updateCfTemplateFromHttp.bind(this));
    });

    // Add models
    this.cfTemplate.Outputs.AwsDocApiId = {
      Description: 'API ID',
      Value: restApiId,
    };
  }
}

module.exports = ServerlessAWSDocumentation;
