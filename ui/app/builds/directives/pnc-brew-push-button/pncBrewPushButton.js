/*
 * JBoss, Home of Professional Open Source.
 * Copyright 2014-2019 Red Hat, Inc., and individual contributors
 * as indicated by the @author tags.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function () {
  'use strict';

  angular.module('pnc.build-records').component('pncBrewPushButton', {
    bindings: {
      buildRecord: '<?',
      groupBuild: '<?'
    },
    templateUrl: 'builds/directives/pnc-brew-push-button/pnc-brew-push-button.html',
    controller: ['$uibModal', 'pncNotify', 'BuildRecord', 'GroupBuildResource', 'messageBus', Controller]
  });

  function Controller($uibModal, pncNotify, BuildRecord, GroupBuildResource, messageBus) {
    var $ctrl = this,
        unsubscribes = [];

    // -- Controller API --

    $ctrl.isButtonVisible = isButtonVisible;
    $ctrl.openTagNameModal = openTagNameModal;

    // --------------------

    function isBuildRecord() {
      return angular.isDefined($ctrl.buildRecord);
    }

    function isBuildGroupRecord() {
      return angular.isDefined($ctrl.groupBuild);
    }

    function isButtonVisible() {
      if (isBuildRecord()) {
        return $ctrl.buildRecord.$isSuccess();
      } else if (isBuildGroupRecord()) {
        return GroupBuildResource.isSuccess($ctrl.groupBuild);
      }
    }

    function openTagNameModal() {
      var modal = $uibModal.open({
        animation: true,
        backdrop: 'static',
        component: 'pncEnterBrewTagNameModal',
        size: 'md'
      });

      modal.result.then(function (modalValues) {
        return isBuildRecord() ? doPushBuildRecord(modalValues) : doPushGroupBuild(modalValues);
      });
    }

    function subscribe(statuses) {
      statuses.forEach(function (status) {
        unsubscribes.push(messageBus.subscribe({
          topic: 'causeway-push',
          id: status.id
        }));
      });
    }

    function notify(statusObj) {
      switch (statusObj.status) {
        case 'ACCEPTED':
          pncNotify.info('Brew push initiated for build: ' + statusObj.name + '#' + statusObj.id);
          break;
        case 'FAILED':
        case 'SYSTEM_ERROR':
        case 'REJECTED':
          pncNotify.error('Brew push failed for build: ' + statusObj.name + '#' + statusObj.id);
          break;
        case 'CANCELED':
          pncNotify.info('Brew push canceled for build: ' + statusObj.name + '#' + statusObj.id);
          break;
      }
    }

    function filterAccepted(statuses) {
      return statuses.filter(function (status) {
        return status.status === 'ACCEPTED';
      });
    }

    function filterRejected(statuses) {
      return statuses.filter(function (status) {
        return status.status !== 'ACCEPTED';
      });
    }

    function doPushBuildRecord(modalValues) {
      BuildRecord.push($ctrl.buildRecord.id, modalValues.tagName).then(function (response) {
        subscribe(response.data);
        notify(response.data[0]);
      });
    }

    function doPushGroupBuild(modalValues) {
      GroupBuildResource.brewPush($ctrl.groupBuild.id, modalValues.tagName).then(function (response) {
        const accepted = filterAccepted(response.data),
              rejected = filterRejected(response.data);

        if (accepted.length > 0) {
          subscribe(accepted);
        }

        if (rejected.length === 0) {
          pncNotify.info('Brew push initiated for Group Build: ' + GroupBuildResource.canonicalName($ctrl.groupBuild));
        } else {
          pncNotify.warn('Some Build Records were rejected for brew push of Group Build: ' + GroupBuildResource.canonicalName($ctrl.groupBuild));
          rejected.forEach(function (reject) {
            notify(reject);
          });
        }
      });
    }
  }

})();
