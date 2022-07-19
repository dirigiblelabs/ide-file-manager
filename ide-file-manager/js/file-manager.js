/*
 * Copyright (c) 2010-2022 SAP SE or an SAP affiliate company and Eclipse Dirigible contributors
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-FileCopyrightText: 2010-2022 SAP SE or an SAP affiliate company and Eclipse Dirigible contributors
 * SPDX-License-Identifier: EPL-2.0
 */
let fileManagerView = angular.module('fileManager', ['ideUI', 'ideView', 'ideEditors', 'ideTransport', 'ideRepository']);
fileManagerView.controller('FileManagerViewController', [
    '$scope',
    'messageHub',
    'Editors',
    'transportApi',
    'repositoryApi',
    function (
        $scope,
        messageHub,
        Editors,
        transportApi,
        repositoryApi
    ) {
        $scope.searchVisible = false;
        $scope.searchField = { text: '' };
        $scope.newNodeData = {
            parent: '',
            path: '',
        };
        $scope.renameNodeData;
        $scope.imageFileExts = ['ico', 'bmp', 'png', 'jpg', 'jpeg', 'gif', 'svg'];
        $scope.modelFileExts = ['extension', 'extensionpoint', 'edm', 'model', 'dsm', 'schema', 'bpmn', 'job', 'listener', 'websocket', 'roles', 'constraints', 'table', 'view'];

        $scope.treeData = [];
        $scope.basePath = '/';

        $scope.jstreeWidget = angular.element('#dgFileManager');
        $scope.spinnerObj = {
            text: "Loading...",
            type: "spinner",
            li_attr: { spinner: true },
        };
        $scope.jstreeConfig = {
            core: {
                check_callback: true,
                themes: {
                    name: "fiori",
                    variant: "compact",
                },
                data: function (node, cb) {
                    cb($scope.treeData);
                },
            },
            search: {
                case_sensitive: false,
            },
            plugins: ['wholerow', 'dnd', 'search', 'state', 'types', 'sort'],
            dnd: {
                large_drop_target: true,
                large_drag_target: true,
            },
            sort: function (firstNodeId, secondNodeId) {
                let firstNode = this.get_node(firstNodeId);
                let secondNode = this.get_node(secondNodeId);
                if (firstNode.type === "spinner") return -1;
                else if (secondNode.type === "spinner") return 1;
                else if (firstNode.type === secondNode.type) {
                    let res = firstNode.text.localeCompare(secondNode.text, "en-GB", { numeric: true, sensitivity: "base" });
                    if (res < 0) return -1;
                    else if (res > 0) return 1;
                    return 0;
                } else if (firstNode.type === "folder") return -1;
                else if (secondNode.type === "folder") return 1;
                else {
                    let res = firstNode.text.localeCompare(secondNode.text, "en-GB", { numeric: true, sensitivity: "base" });
                    if (res < 0) return -1;
                    else if (res > 0) return 1;
                    return 0;
                }
            },
            state: { key: 'ide-file-manager' },
            types: {
                "default": {
                    icon: "sap-icon--question-mark",
                    valid_children: [],
                },
                file: {
                    icon: "jstree-file",
                    valid_children: [],
                },
                folder: {
                    icon: "jstree-folder",
                    valid_children: ['folder', 'file', 'spinner'],
                },
                spinner: {
                    icon: "jstree-spinner",
                    valid_children: [],
                },
            },
        };

        $scope.jstreeWidget.on('select_node.jstree', function (event, data) {
            if (data.event && data.event.type === 'click' && data.node.type === 'file') {
                messageHub.announceFileSelected({
                    name: data.node.text,
                    path: data.node.data.path,
                    contentType: data.node.data.contentType,
                });
            }
        });

        $scope.jstreeWidget.on('dblclick.jstree', function (event) {
            let node = $scope.jstreeWidget.jstree(true).get_node(event.target);
            if (node.type === 'file') {
                openFile(node);
            }
        });

        $scope.jstreeWidget.on('copy_node.jstree', function (event, copyObj) {
            // if (!copyObj.node.state.failedCopy) {
            //     $scope.jstreeWidget.jstree(true).hide_node(copyObj.node);
            //     let parent = $scope.jstreeWidget.jstree(true).get_node(copyObj.parent);
            //     let spinnerId = showSpinner(parent);
            //     let path;
            //     path = (parent.data.path.endsWith('/') ? parent.data.path : parent.data.path + '/');
            //     copyObj.node.data = {
            //         path: path + copyObj.node.text,
            //         contentType: copyObj.original.data.contentType,
            //     };
            // } else delete copyObj.node.state.failedCopy;
        });

        $scope.jstreeWidget.on('move_node.jstree', function (event, moveObj) {
            // if (!moveObj.node.state.failedMove) {
            //     let parent = $scope.jstreeWidget.jstree(true).get_node(moveObj.parent);
            //     for (let i = 0; i < parent.children.length; i++) { // Temp solution
            //         let node = $scope.jstreeWidget.jstree(true).get_node(parent.children[i]);
            //         if (node.text === moveObj.node.text && node.id !== moveObj.node.id) {
            //             moveObj.node.state.failedMove = true;
            //             $scope.jstreeWidget.jstree(true).move_node(
            //                 moveObj.node,
            //                 $scope.jstreeWidget.jstree(true).get_node(moveObj.old_parent),
            //                 moveObj.old_position,
            //             );
            //             messageHub.showAlertError('Could not move file', 'The destination contains a file with the same name.');
            //             return;
            //         }
            //     }
            //     $scope.jstreeWidget.jstree(true).hide_node(moveObj.node);
            //     let spinnerId = showSpinner(parent);
            // } else delete moveObj.node.state.failedMove;
        });

        function getChildrenNames(node, type = '') {
            let root = $scope.jstreeWidget.jstree(true).get_node(node);
            let names = [];
            if (type) {
                for (let i = 0; i < root.children.length; i++) {
                    let child = $scope.jstreeWidget.jstree(true).get_node(root.children[i]);
                    if (child.type === type) names.push(child.text);
                }
            } else {
                for (let i = 0; i < root.children.length; i++) {
                    names.push($scope.jstreeWidget.jstree(true).get_text(root.children[i]));
                }
            }
            return names;
        }

        $scope.toggleSearch = function () {
            $scope.searchField.text = '';
            $scope.jstreeWidget.jstree(true).clear_search();
            $scope.searchVisible = !$scope.searchVisible;
        };

        $scope.deleteFileFolder = function (path, callback) {
        };

        $scope.reloadFileTree = function (basePath, setConfig = false) {
            $scope.treeData.length = 0;
            repositoryApi.load(basePath).then(function (response) {
                let collections = processChildren(response.data.collections);
                let resources = processChildren(response.data.resources);
                $scope.treeData = [].concat(collections, resources);
                if (setConfig) $scope.jstreeWidget.jstree($scope.jstreeConfig);
                else $scope.jstreeWidget.jstree(true).refresh();
            })
        };

        $scope.contextMenuContent = function (element) {
            if ($scope.jstreeWidget[0].contains(element)) {
                let id;
                if (element.tagName !== "LI") {
                    let closest = element.closest("li");
                    if (closest) id = closest.id;
                    else return {
                        callbackTopic: "file-manager.tree.contextmenu",
                        items: [
                            {
                                id: "folder",
                                label: "New Folder",
                                icon: "sap-icon--add-folder",
                                data: {
                                    path: $scope.basePath,
                                    parent: '#',
                                },
                            },
                            {
                                id: "file",
                                label: "New File",
                                icon: "sap-icon--add-document",
                                data: {
                                    path: $scope.basePath,
                                    parent: '#',
                                },
                            },
                        ]
                    }
                } else {
                    id = element.id;
                }
                if (id) {
                    let node = $scope.jstreeWidget.jstree(true).get_node(id);
                    let newSubmenu = {
                        id: "new",
                        label: "New",
                        icon: "sap-icon--create",
                        items: [
                            {
                                id: "file",
                                label: "File",
                                data: {
                                    path: node.data.path,
                                    parent: node.id
                                },
                            },
                            {
                                id: "folder",
                                label: "Folder",
                                data: {
                                    path: node.data.path,
                                    parent: node.id
                                },
                            }
                        ]
                    };
                    let menuObj = {
                        callbackTopic: 'file-manager.tree.contextmenu',
                        items: [
                            newSubmenu,
                        ]
                    };
                    return menuObj;
                }
                return;
            } else return;
        };

        let to = 0;
        $scope.search = function () {
            if (to) { clearTimeout(to); }
            to = setTimeout(function () {
                $scope.jstreeWidget.jstree(true).search($scope.searchField.text);
            }, 250);
        };

        function showSpinner(parent) {
            return $scope.jstreeWidget.jstree(true).create_node(parent, $scope.spinnerObj, 0);
        }

        function hideSpinner(spinnerId) {
            $scope.jstreeWidget.jstree(true).delete_node($scope.jstreeWidget.jstree(true).get_node(spinnerId));
        }

        function processChildren(children) {
            let treeChildren = [];
            for (let i = 0; i < children.length; i++) {
                let child = {
                    text: children[i].name,
                    type: (children[i].type === 'collection' ? 'folder' : 'file'),
                    data: {
                        path: children[i].path,
                    }
                };
                if (children[i].type === 'resource') {
                    child.data.contentType = children[i].contentType;
                    let icon = getFileIcon(children[i].name);
                    if (icon) child.icon = icon;
                }
                if (children[i].collections && children[i].resources) {
                    child['children'] = processChildren(children[i].collections.concat(children[i].resources));
                } else if (children[i].collections) {
                    child['children'] = processChildren(children[i].collections);
                } else if (children[i].resources) {
                    child['children'] = processChildren(children[i].resources);
                }
                treeChildren.push(child);
            }
            return treeChildren;
        }

        function getFileExtension(fileName) {
            return fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length).toLowerCase();
        }

        function getFileIcon(fileName) {
            let ext = getFileExtension(fileName);
            let icon;
            if (ext === 'js' || ext === 'mjs' || ext === 'xsjs' || ext === 'ts' || ext === 'json') {
                icon = "sap-icon--syntax";
            } else if (ext === 'css' || ext === 'less' || ext === 'scss') {
                icon = "sap-icon--number-sign";
            } else if (ext === 'txt') {
                icon = "sap-icon--text";
            } else if (ext === 'pdf') {
                icon = "sap-icon--pdf-attachment";
            } else if ($scope.imageFileExts.indexOf(ext) !== -1) {
                icon = "sap-icon--picture";
            } else if ($scope.modelFileExts.indexOf(ext) !== -1) {
                icon = "sap-icon--document-text";
            } else {
                icon = 'jstree-file';
            }
            return icon;
        }

        function getEditorsForType(node) {
            let editors = [{
                id: 'openWith',
                label: Editors.defaultEditor.label,
                data: {
                    node: node,
                    editorId: Editors.defaultEditor.id,
                }
            }];
            let editorsForContentType = Editors.editorsForContentType;
            if (Object.keys(editorsForContentType).indexOf(node.data.contentType) > -1) {
                for (let i = 0; i < editorsForContentType[node.data.contentType].length; i++) {
                    if (editorsForContentType[node.data.contentType][i].id !== Editors.defaultEditor.id)
                        editors.push({
                            id: 'openWith',
                            label: editorsForContentType[node.data.contentType][i].label,
                            data: {
                                node: node,
                                editorId: editorsForContentType[node.data.contentType][i].id,
                            }
                        });
                }
            }
            return editors;
        }

        function openFile(node, editor = undefined) {
            let parent = node;
            let extraArgs;
            for (let i = 0; i < node.parents.length - 1; i++) {
                parent = $scope.jstreeWidget.jstree(true).get_node(parent.parent);
            }
            if (parent.data.git) {
                extraArgs = { gitName: parent.data.gitName };
            }
            messageHub.openEditor(
                `node.data.path`,
                node.text,
                node.data.contentType,
                editor,
                extraArgs
            );
        }

        function createFile(parent, name, path) {
            repositoryApi.createResource(path, name).then(function (response) {
                if (response.status === 201) {
                    console.log(response.data);
                    repositoryApi.getMetadata(response.data).then(function (metadata) {
                        if (metadata.status === 200) {
                            console.log(metadata);
                            $scope.jstreeWidget.jstree(true).deselect_all(true);
                            $scope.jstreeWidget.jstree(true).select_node(
                                $scope.jstreeWidget.jstree(true).create_node(
                                    parent,
                                    {
                                        text: metadata.data.name,
                                        type: 'file',
                                        data: {
                                            path: metadata.data.path,
                                        }
                                    },
                                )
                            );
                        } else {
                            messageHub.showAlertError('Could not get metadata', `There was an error while getting metadata for '${name}'`);
                        }
                    });
                } else {
                    messageHub.showAlertError('Could not create a file', `There was an error while creating '${name}'`);
                }
            });
        }

        function createFolder(parent, name, path) {
            repositoryApi.createCollection(path, name).then(function (response) {
                if (response.status === 201) {
                    repositoryApi.getMetadata(response.data).then(function (metadata) {
                        if (metadata.status === 200) {
                            $scope.jstreeWidget.jstree(true).deselect_all(true);
                            $scope.jstreeWidget.jstree(true).select_node(
                                $scope.jstreeWidget.jstree(true).create_node(
                                    parent,
                                    {
                                        text: metadata.data.name,
                                        type: 'folder',
                                        data: {
                                            path: metadata.data.path,
                                        }
                                    },
                                )
                            );
                        } else {
                            messageHub.showAlertError('Could not get metadata', `There was an error while getting metadata for '${name}'`);
                        }
                    });
                } else {
                    messageHub.showAlertError('Could not create a folder', `There was an error while creating '${name}'`);
                }
            });
        }

        messageHub.onDidReceiveMessage(
            'file-manager.tree.select',
            function (msg) {
                let objects = $scope.jstreeWidget.jstree(true).get_json(
                    '#',
                    {
                        no_state: true,
                        no_li_attr: true,
                        no_a_attr: true,
                        flat: true
                    }
                );
                for (let i = 0; i < objects.length; i++) {
                    if (objects[i].data.path === msg.data.filePath) {
                        $scope.jstreeWidget.jstree(true).select_node(objects[i]);
                        break;
                    }
                }
            },
            true
        );

        messageHub.onDidReceiveMessage(
            "file-manager.formDialog.create.file",
            function (msg) {
                if (msg.data.buttonId === "b1") {
                    createFile($scope.newNodeData.parent, msg.data.formData[0].value, $scope.newNodeData.path);
                }
                messageHub.hideFormDialog("fileManagerNewFileForm");
            },
            true
        );

        messageHub.onDidReceiveMessage(
            "file-manager.formDialog.create.folder",
            function (msg) {
                if (msg.data.buttonId === "b1") {
                    createFolder($scope.newNodeData.parent, msg.data.formData[0].value, $scope.newNodeData.path);
                }
                messageHub.hideFormDialog("fileManagerNewFolderForm");
            },
            true
        );

        messageHub.onDidReceiveMessage(
            "file-manager.formDialog.rename",
            function (msg) {
                if (msg.data.buttonId === "b1") {
                } else {
                    messageHub.hideFormDialog("fileManagerRenameForm");
                }
            },
            true
        );

        messageHub.onDidReceiveMessage(
            'file-manager.tree.contextmenu',
            function (msg) {
                if (msg.data.itemId === 'open') {
                    openFile(msg.data.data);
                } else if (msg.data.itemId === 'openWith') {
                    openFile(msg.data.data.node, msg.data.data.editorId);
                } else if (msg.data.itemId === 'file') {
                    $scope.newNodeData.parent = msg.data.data.parent;
                    $scope.newNodeData.path = msg.data.data.path;
                    messageHub.showFormDialog(
                        "fileManagerNewFileForm",
                        "Create a new file",
                        [{
                            id: "fdti1",
                            type: "input",
                            label: "Name",
                            required: true,
                            inputRules: {
                                excluded: getChildrenNames(msg.data.data.parent, 'file'),
                                patterns: ['^[^/:]*$'],
                            },
                            value: '',
                        }],
                        [{
                            id: "b1",
                            type: "emphasized",
                            label: "Create",
                            whenValid: true
                        },
                        {
                            id: "b2",
                            type: "transparent",
                            label: "Cancel",
                        }],
                        "file-manager.formDialog.create.file",
                        "Creating..."
                    );
                } else if (msg.data.itemId === 'folder') {
                    $scope.newNodeData.parent = msg.data.data.parent;
                    $scope.newNodeData.path = msg.data.data.path;
                    messageHub.showFormDialog(
                        "fileManagerNewFolderForm",
                        "Create new folder",
                        [{
                            id: "fdti1",
                            type: "input",
                            label: "Name",
                            required: true,
                            inputRules: {
                                excluded: getChildrenNames(msg.data.data.parent, 'folder'),
                                patterns: ['^[^/:]*$'],
                            },
                            value: '',
                        }],
                        [{
                            id: "b1",
                            type: "emphasized",
                            label: "Create",
                            whenValid: true
                        },
                        {
                            id: "b2",
                            type: "transparent",
                            label: "Cancel",
                        }],
                        "file-manager.formDialog.create.folder",
                        "Creating..."
                    );
                } else if (msg.data.itemId === 'rename') {
                    $scope.renameNodeData = msg.data.data;
                    messageHub.showFormDialog(
                        "fileManagerRenameForm",
                        `Rename ${$scope.renameNodeData.type}`,
                        [{
                            id: "fdti1",
                            type: "input",
                            label: "Name",
                            required: true,
                            inputRules: {
                                excluded: getChildrenNames($scope.renameNodeData.parent, 'file'),
                                patterns: ['^[^/:]*$'],
                            },
                            value: $scope.renameNodeData.text,
                        }],
                        [{
                            id: "b1",
                            type: "emphasized",
                            label: "Rename",
                            whenValid: true
                        },
                        {
                            id: "b2",
                            type: "transparent",
                            label: "Cancel",
                        }],
                        "file-manager.formDialog.rename",
                        "Renameing..."
                    );
                } else if (msg.data.itemId === 'delete') {
                    messageHub.showDialogAsync(
                        `Delete '${msg.data.data.text}'?`,
                        'This action cannot be undone. It is recommended that you unpublish and delete.',
                        [{
                            id: 'b1',
                            type: 'negative',
                            label: 'Delete',
                        },
                        {
                            id: 'b2',
                            type: 'emphasized',
                            label: 'Delete & Unpublish',
                        },
                        {
                            id: 'b3',
                            type: 'transparent',
                            label: 'Cancel',
                        }],
                    ).then(function (dialogResponse) {
                        function deleteNode() {
                            $scope.jstreeWidget.jstree(true).delete_node(msg.data.data);
                        };
                        if (dialogResponse.data === 'b1') {
                            $scope.deleteFileFolder(msg.data.data.data.path, deleteNode);
                        } else if (dialogResponse.data === 'b2') {
                            $scope.deleteFileFolder(msg.data.data.data.path, deleteNode);
                        }
                    });
                } else if (msg.data.itemId === 'cut') {
                    $scope.jstreeWidget.jstree(true).cut(msg.data.data);
                } else if (msg.data.itemId === 'copy') {
                    $scope.jstreeWidget.jstree(true).copy(msg.data.data);
                } else if (msg.data.itemId === 'paste') {
                    $scope.jstreeWidget.jstree(true).paste(msg.data.data);
                }
            },
            true
        );

        // Initialization
        $scope.reloadFileTree($scope.basePath, true);
    }]);