import components from '../utilities/components';
import DisplayLayer from './display.layer';
import is from '../utilities/is';
import React from 'react';

/** @namespace existingPost.data.stickied */

const oneMinute = 6000; // CHANGE THIS TO BE 60000

export default class DataLayer extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			lastSearch : {
				failed : false,
				subreddit : null,
			},
			posts : [],
		};
		components.DataLayer = this;
		this.currentPage = 1;
	}
	
	addNewPosts(originalPosts, latestPosts) {
		let updatedPosts = JSON.parse(JSON.stringify(originalPosts));
		let indexOfFirstNonstickyExistingPost = -1;
		let originalPostIds = [];
		originalPosts.forEach((originalPost, originalPostIndex) => {
			if (indexOfFirstNonstickyExistingPost !== -1 && !originalPost.data.stickied) {
				indexOfFirstNonstickyExistingPost = originalPostIndex;
			}
			originalPostIds.push(originalPost.data.id);
		});
		latestPosts.forEach((latestPost, latestPostIndex) => {
			if (!originalPostIds.some(originalPostId => originalPostId === latestPost.data.id)) {
				updatedPosts.splice(indexOfFirstNonstickyExistingPost, 0, latestPost);
			}
		});
		return updatedPosts;
	}
	
	appendToSubreddit() {
		const lastPost = this.state.posts[this.state.posts.length - 1].data;
		const { lastSearch } = this.state;
		const promise = fetch(`https://www.reddit.com/r/${lastSearch.subreddit}.json?limit=100&after=t3_${lastPost.id}`)
			.then(response => response.json())
			.catch(error => {
				console.error(`error trying to append to the ${lastSearch.subreddit} subreddit`);
				console.error(error);
			});
		promise.then(response => {
			if (response && response.data) {
				const combinedPosts = [...this.state.posts, ...response.data.children];
				this.setState({posts : combinedPosts});
			}
		});
	}
	
	componentDidMount() {
		this.updateSubreddit();
	}
	
	getSubreddit(subreddit = '') {
		if (!is.aPopulatedString(subreddit)) return;
		const promise = fetch(`https://www.reddit.com/r/${subreddit}.json?limit=100`)
			.then(response => response.json())
			.catch(error => {
				console.error(`error trying to retrieve the ${subreddit} subreddit`);
				console.error(error);
			});
		promise.then(response => {
			if (!response) {
				this.setState({
					lastSearch : {
						failed : true,
						subreddit : subreddit,
					},
					posts : [],
				});
				return;
			}
			if (response.data && response.data.children) {
				this.currentPage = 1;
				this.setState({
					lastSearch : {
						failed : false,
						subreddit : subreddit,
					},
					posts : response.data.children,
				});
			}
		});
	}
	
	removeDeletedPosts(originalPosts, latestPosts) {
		let updatedPosts = JSON.parse(JSON.stringify(originalPosts));
		let latestPostIds = [];
		latestPosts.forEach((latestPost, latestPostIndex) => {
			latestPostIds.push(latestPost.data.id);
		});
		let originalPostIndexesToRemove = [];
		originalPosts.forEach((originalPost, originalPostIndex) => {
			if (!latestPostIds.some(latestPostId => latestPostId === originalPost.data.id)) {
				originalPostIndexesToRemove.push(originalPostIndex);
			}
		});
		for (let i = originalPostIndexesToRemove.length - 1; i >= 0; i--) {
			const indexToRemove = originalPostIndexesToRemove[i];
			updatedPosts.splice(indexToRemove, 1);
		}
		return updatedPosts;
	}
	
	updateExistingPosts(originalPosts, latestPosts) {
		let updatedPosts = JSON.parse(JSON.stringify(originalPosts));
		latestPosts.forEach((latestPost, latestPostIndex) => {
			let indexFound = false;
			originalPosts.forEach((originalPost, originalPostIndex) => {
				if (indexFound) return;
				if (originalPost.data.id === latestPost.data.id) {
					indexFound = true;
					const latestPostJson = JSON.stringify(latestPost);
					const originalPostJson = JSON.stringify(originalPost);
					if (originalPostJson !== latestPostJson) {
						updatedPosts[originalPostIndex] = JSON.parse(latestPostJson);
					}
				}
			});
		});
		return updatedPosts;
	}
	
	render() {
		return <DisplayLayer/>;
	}
	
	updateSubreddit() {
		setTimeout(() => {
			const { lastSearch } = this.state;
			let url = `https://www.reddit.com/r/${lastSearch.subreddit}.json?limit=25`;
			if (this.currentPage > 1) {
				const previousPostIndex = (this.currentPage * 25) - 1;
				const after = this.state.posts[previousPostIndex].data.id;
				url += `&after=tp3_${after}`;
			}
			const promise = fetch(url)
				.then(response => response.json())
				.catch(error => {
					console.error(`error trying to update the ${lastSearch.subreddit} subreddit`);
					console.error(error);
				});
			promise.then(response => {
				if (response && response.data && response.data.children) {
					let originalPosts = JSON.parse(JSON.stringify(this.state.posts));
					let originalPostsJson = JSON.stringify(this.state.posts);
					let latestPosts = JSON.parse(JSON.stringify(response.data.children));
					let updatedPosts = this.updateExistingPosts(originalPosts, latestPosts);
					updatedPosts = this.addNewPosts(updatedPosts, latestPosts);
					updatedPosts = this.removeDeletedPosts(updatedPosts, latestPosts);
					const updatedPostsJson = JSON.stringify(updatedPosts);
					if (updatedPostsJson !== originalPostsJson) {
						this.setState({posts : updatedPosts});
					}
				}
			});
			this.updateSubreddit();
		}, oneMinute);
	}
}