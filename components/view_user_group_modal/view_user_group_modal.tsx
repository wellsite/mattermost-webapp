// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef, RefObject} from 'react';

import {Modal} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import {UserProfile} from 'mattermost-redux/types/users';

import Constants from 'utils/constants';

import FaSearchIcon from 'components/widgets/icons/fa_search_icon';
import Avatar from 'components/widgets/users/avatar';
import * as Utils from 'utils/utils.jsx';
import LoadingScreen from 'components/loading_screen';
import {Group} from 'mattermost-redux/types/groups';

import './view_user_group_modal.scss';
import {debounce} from 'mattermost-redux/actions/helpers';

import LocalizedIcon from 'components/localized_icon';
import {t} from 'utils/i18n';
import {ActionResult} from 'mattermost-redux/types/actions';
import Input from 'components/input';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import ViewUserGroupModalHeader from './view_user_group_modal_header';

const USERS_PER_PAGE = 60;

export type Props = {
    onExited: () => void;
    searchTerm: string;
    groupId: string;
    group?: Group;
    users: UserProfile[];
    backButtonCallback: () => void;
    backButtonAction: () => void;
    permissionToLeaveGroup: boolean;
    actions: {
        getGroup: (groupId: string, includeMemberCount: boolean) => Promise<{data: Group}>;
        getUsersInGroup: (groupId: string, page: number, perPage: number) => Promise<{data: UserProfile[]}>;
        setModalSearchTerm: (term: string) => void;
        searchProfiles: (term: string, options: any) => Promise<ActionResult>;
        removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    };
}

type State = {
    page: number;
    loading: boolean;
    show: boolean;
    selectedFilter: string;
    memberCount: number;
}

export default class ViewUserGroupModal extends React.PureComponent<Props, State> {
    private divScrollRef: RefObject<HTMLDivElement>;
    private searchTimeoutId: number

    constructor(props: Props) {
        super(props);

        this.divScrollRef = createRef();
        this.searchTimeoutId = 0;

        this.state = {
            page: 0,
            loading: true,
            show: true,
            selectedFilter: 'all',
            memberCount: props.group?.member_count || 0,
        };
    }

    incrementMemberCount = () => {
        this.setState({memberCount: this.state.memberCount + 1});
    }

    decrementMemberCount = () => {
        this.setState({memberCount: this.state.memberCount - 1});
    }

    doHide = () => {
        this.setState({show: false});
    }

    async componentDidMount() {
        const {
            groupId,
            actions,
        } = this.props;

        await Promise.all([
            actions.getGroup(groupId, true),
            actions.getUsersInGroup(groupId, 0, USERS_PER_PAGE),
        ]);
        this.loadComplete();
    }

    componentWillUnmount() {
        this.props.actions.setModalSearchTerm('');
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);
            const searchTerm = this.props.searchTerm;

            if (searchTerm === '') {
                this.loadComplete();
                this.searchTimeoutId = 0;
                return;
            }

            const searchTimeoutId = window.setTimeout(
                async () => {
                    await prevProps.actions.searchProfiles(searchTerm, {in_group_id: this.props.groupId});
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );

            this.searchTimeoutId = searchTimeoutId;
        }
    }

    startLoad = () => {
        this.setState({loading: true});
    }

    loadComplete = () => {
        this.setState({loading: false});
    }

    handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        this.props.actions.setModalSearchTerm(term);
    }

    getGroupMembers = debounce(
        async () => {
            const {actions, groupId} = this.props;
            const {page} = this.state;
            const newPage = page + 1;

            this.setState({page: newPage});

            this.startLoad();
            await actions.getUsersInGroup(groupId, newPage, USERS_PER_PAGE);
            this.loadComplete();
        },
        200,
        false,
        (): void => {},
    );

    onScroll = () => {
        const scrollHeight = this.divScrollRef.current?.scrollHeight || 0;
        const scrollTop = this.divScrollRef.current?.scrollTop || 0;
        const clientHeight = this.divScrollRef.current?.clientHeight || 0;

        if (((scrollTop + clientHeight + 30) >= scrollHeight && this.props.group) && (this.props.users.length !== this.props.group.member_count && this.state.loading === false)) {
            this.getGroupMembers();
        }
    }

    removeUserFromGroup = async (userId: string) => {
        const {groupId, actions} = this.props;

        await actions.removeUsersFromGroup(groupId, [userId]).then(() => {
            this.decrementMemberCount();
        });
    }

    mentionName = () => {
        const {group} = this.props;

        if (group) {
            return (
                <div className='group-mention-name'>
                    <span className='group-name'>{`@${group.name}`}</span>
                    {
                        group.source.toLowerCase() === 'ldap' &&
                        <span className='group-source'>
                            <FormattedMessage
                                id='view_user_group_modal.ldapSynced'
                                defaultMessage='AD/LDAP SYNCED'
                            />
                        </span>
                    }
                </div>
            );
        }
        return (<></>);
    }

    render() {
        const {groupId, group, users, onExited} = this.props;

        return (
            <Modal
                dialogClassName='a11y__modal view-user-groups-modal'
                show={this.state.show}
                onHide={this.doHide}
                onExited={onExited}
                role='dialog'
                aria-labelledby='viewUserGroupModalLabel'
            >
                <ViewUserGroupModalHeader
                    onExited={onExited}
                    groupId={groupId}
                    backButtonCallback={this.props.backButtonCallback}
                    backButtonAction={this.props.backButtonAction}
                    incrementMemberCount={this.incrementMemberCount}
                    decrementMemberCount={this.decrementMemberCount}
                />
                <Modal.Body>
                    {this.mentionName()}
                    {((users.length === 0 && !this.props.searchTerm && !this.state.loading) || !group) ?
                        <NoResultsIndicator
                            variant={NoResultsVariant.UserGroupMembers}
                        /> :
                        <>
                            <div className='user-groups-search'>
                                <FaSearchIcon/>
                                <Input
                                    type='text'
                                    placeholder={Utils.localizeMessage('search_bar.searchGroupMembers', 'Search group members')}
                                    onChange={this.handleSearch}
                                    value={this.props.searchTerm}
                                    data-testid='searchInput'
                                    className={'user-group-search-input'}
                                />
                            </div>
                            <div
                                className='user-groups-modal__content group-member-list'
                                onScroll={this.onScroll}
                                ref={this.divScrollRef}
                            >
                                {(users.length !== 0) &&
                                    <h2 className='group-member-count'>
                                        <FormattedMessage
                                            id='view_user_group_modal.memberCount'
                                            defaultMessage='{member_count} {member_count, plural, one {Member} other {Members}}'
                                            values={{
                                                member_count: this.state.memberCount,
                                            }}
                                        />
                                    </h2>
                                }
                                {(users.length === 0 && this.props.searchTerm) &&
                                    <NoResultsIndicator
                                        variant={NoResultsVariant.ChannelSearch}
                                        titleValues={{channelName: `"${this.props.searchTerm}"`}}
                                    />
                                }
                                {users.map((user) => {
                                    return (
                                        <div
                                            key={user.id}
                                            className='group-member-row'
                                        >
                                            <>
                                                <Avatar
                                                    username={user.username}
                                                    size={'sm'}
                                                    url={Utils.imageURLForUser(user?.id ?? '')}
                                                    className={'avatar-post-preview'}
                                                />
                                            </>
                                            <div className='group-member-name'>
                                                {Utils.getFullName(user)}
                                            </div>
                                            <div className='group-member-username'>
                                                {`@${user.username}`}
                                            </div>
                                            {
                                                (group.source.toLowerCase() !== 'ldap' && this.props.permissionToLeaveGroup) &&
                                                <button
                                                    type='button'
                                                    className='remove-group-member btn-icon'
                                                    aria-label='Close'
                                                    onClick={() => {
                                                        this.removeUserFromGroup(user.id);
                                                    }}
                                                >
                                                    <LocalizedIcon
                                                        className='icon icon-trash-can-outline'
                                                        ariaLabel={{id: t('user_groups_modal.goBackLabel'), defaultMessage: 'Back'}}
                                                    />
                                                </button>
                                            }
                                        </div>
                                    );
                                })}
                                {
                                    this.state.loading &&
                                    <LoadingScreen/>
                                }
                            </div>
                        </>
                    }
                </Modal.Body>
            </Modal>
        );
    }
}
