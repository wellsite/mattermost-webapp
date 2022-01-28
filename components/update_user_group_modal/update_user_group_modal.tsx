// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {Modal} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils.jsx';
import {CustomGroupPatch, Group} from 'mattermost-redux/types/groups';

import 'components/user_groups_modal/user_groups_modal.scss';
import './update_user_group_modal.scss';
import {ModalData} from 'types/actions';
import Input from 'components/input';
import {ActionResult} from 'mattermost-redux/types/actions';
import LocalizedIcon from 'components/localized_icon';
import {t} from 'utils/i18n';

import SaveButton from 'components/save_button';

export type Props = {
    onExited: () => void;
    groupId: string;
    group: Group;
    backButtonCallback: () => void;
    actions: {
        patchGroup: (groupId: string, group: CustomGroupPatch) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

const UpdateUserGroupModal = (props: Props) => {
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState(true);
    const [name, setName] = useState(props.group.display_name);
    const [mention, setMention] = useState(`@${props.group.name}`);
    const [mentionInputErrorText, setMentionInputErrorText] = useState('');
    const [nameInputErrorText, setNameInputErrorText] = useState('');
    const [hasUpdated, setHasUpdated] = useState(false);
    const [showUnknownError, setShowUnknownError] = useState(false);
    const [mentionUpdatedManually, setMentionUpdatedManually] = useState(false);

    const doHide = () => {
        setShow(false);
    }

    const isSaveEnabled = () => {
        return name.length > 0 && mention.length > 0 && hasUpdated && !saving;
    }

    const updateNameState = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        let newMention = mention;
        if (!mentionUpdatedManually) {
            newMention = value.replace(/[^A-Za-z0-9@]/g, '').toLowerCase();
            if (newMention.substring(0, 1) !== '@') {
                newMention = `@${newMention}`;
            }
        }
        setName(value);
        setHasUpdated(true);
        setMention(newMention);
    }

    const updateMentionState = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setHasUpdated(true);
        setMention(value);
        setMentionUpdatedManually(true);
    }

    const patchGroup = async () => {
        setSaving(true);
        let newMention = mention;
        const displayName = name;

        if (displayName.length < 1) {
            setNameInputErrorText(Utils.localizeMessage('user_groups_modal.nameIsEmpty', 'Name is a required field.'));
            return;
        }

        if (newMention.substring(0, 1) === '@') {
            newMention = newMention.substring(1, newMention.length);
        }

        if (newMention.length < 1) {
            setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionIsEmpty', 'Mention is a required field.'));
            return;
        }

        const mentionRegEx = new RegExp(/[^A-Za-z0-9]/g);
        if (mentionRegEx.test(newMention)) {
            setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionInvalidError', 'Invalid character in mention.'));
            return;
        }

        const group: CustomGroupPatch = {
            name: newMention,
            display_name: displayName,
        };
        const data = await props.actions.patchGroup(props.groupId, group);
        if (data?.error) {
            if (data.error?.server_error_id === 'app.custom_group.unique_name') {
                setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionNotUnique', 'Mention needs to be unique.'));
                setSaving(false);
            } else {
                setShowUnknownError(true);
                setSaving(false);
            }
        } else {
            goBack();
        }
    }
    const goBack = () => {
        props.backButtonCallback();
        props.onExited();
    }

    return (
        <Modal
            dialogClassName='a11y__modal user-groups-modal-update'
            show={show}
            onHide={doHide}
            onExited={props.onExited}
            role='dialog'
            aria-labelledby='createUserGroupsModalLabel'
            id='createUserGroupsModal'
        >
            <Modal.Header closeButton={true}>
                <button
                    type='button'
                    className='modal-header-back-button btn-icon'
                    aria-label='Close'
                    onClick={() => {
                        goBack();
                    }}
                >
                    <LocalizedIcon
                        className='icon icon-arrow-left'
                        ariaLabel={{id: t('user_groups_modal.goBackLabel'), defaultMessage: 'Back'}}
                    />
                </button>
                <Modal.Title
                    componentClass='h1'
                    id='updateGroupsModalTitle'
                >
                    <FormattedMessage
                        id='user_groups_modal.editGroupTitle'
                        defaultMessage='Edit Group Details'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body
                className='overflow--visible'
            >
                <div className='user-groups-modal__content'>
                    <form role='form'>
                        <div className='group-name-input-wrapper'>
                            <Input
                                type='text'
                                placeholder={Utils.localizeMessage('user_groups_modal.name', 'Name')}
                                onChange={updateNameState}
                                value={name}
                                data-testid='nameInput'
                                autoFocus={true}
                                error={nameInputErrorText}
                            />
                        </div>
                        <div className='group-mention-input-wrapper'>
                            <Input
                                type='text'
                                placeholder={Utils.localizeMessage('user_groups_modal.mention', 'Mention')}
                                onChange={updateMentionState}
                                value={mention}
                                data-testid='nameInput'
                                error={mentionInputErrorText}
                            />
                        </div>
                        <div className='update-buttons-wrapper'>
                            {
                                showUnknownError &&
                                <div className='Input___error group-error'>
                                    <i className='icon icon-alert-outline'/>
                                    <FormattedMessage
                                        id='user_groups_modal.unknownError'
                                        defaultMessage='An unknown error has occurred.'
                                    />
                                </div>
                            }
                            <button
                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                    e.preventDefault();
                                    goBack();
                                }}
                                className='btn update-group-back'
                            >
                                {Utils.localizeMessage('multiselect.backButton', 'Back')}
                            </button>
                            <SaveButton
                                id='saveItems'
                                saving={saving}
                                disabled={!isSaveEnabled()}
                                onClick={(e) => {
                                    e.preventDefault();
                                    patchGroup();
                                }}
                                defaultMessage={Utils.localizeMessage('multiselect.saveDetailsButton', 'Save Details')}
                                savingMessage={Utils.localizeMessage('multiselect.savingDetailsButton', 'Saving...')}
                            />
                        </div>

                    </form>
                </div>
            </Modal.Body>
        </Modal>
    );
}

export default UpdateUserGroupModal;
