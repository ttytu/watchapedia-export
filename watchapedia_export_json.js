!async function () {
	const userId = document.querySelector('a[href*="/users/"]').href.replace(/^.*\/users\/(.*)$/, "$1");

	const fetchData = async (endpoint) => {
		return fetch(`https://api-pedia.watcha.com${endpoint}`, {
			credentials: "same-origin",
			headers: {
				"x-watcha-client": "watcha-WebApp",
				"x-watcha-client-language": "ko",
				"x-watcha-client-region": "KR",
				"x-watcha-client-version": "2.1.0"
			}
		})
			.then(response => response.json())
			.then(data => data.result);
	};

	const fetchContentDetails = async (contentId) => {
		const details = await fetchData(`/api/contents/${contentId}`);
		return {
			original_title: details.original_title,
			duration: details.duration,
			stillcut: details.stillcut,
			nations: details.nations,
			genres: details.genres
		};
	};

	const fetchAllContent = async (endpoint, progressCallback) => {
		let data = await fetchData(endpoint);
		const contents = [];

		contents.push(...data.result);

		let nextUri = data.next_uri;
		while (nextUri) {
			data = await fetchData(nextUri);
			contents.push(...data.result);
			if (progressCallback) progressCallback(data.result.length);
			nextUri = data.next_uri;
		}

		return contents;
	};

	const fetchUserContents = async (type, progressCallback) => {
		let count = 0;
		const updateProgress = (increment) => {
			count += increment;
			if (progressCallback) progressCallback(count);
		};

		const ratings = await fetchAllContent(`/api/users/${userId}/contents/${type}/ratings`, updateProgress);
		const comments = await fetchAllContent(`/api/users/${userId}/contents/${type}/comments`, updateProgress);

		return { ratings, comments };
	};

	await (async () => {
		const { setProgress, destroy } = (() => {
			const container = Object.assign(document.createElement("div"), {
				style: "position: fixed; left: 0; top: 0; right: 0;height: 59px; z-index:60;display:flex; align-items: center; background-color:#fff"
			});
			const innerContainer = Object.assign(document.createElement("div"), {
				style: "max-width:1320px;width:100%;height:100%;margin:0 auto;display:flex; align-items: center;padding:0 32px;"
			});
			const progressText = Object.assign(document.createElement("p"), {
				style: "color: #7e7e7e; font-size: 15px; letter-spacing: -0.3px;"
			});
			progressText.innerText = "리뷰 다운로드 중입니다.";
			const progressValue = Object.assign(document.createElement("span"), {
				style: "font-weight: bold"
			});
			progressText.appendChild(progressValue);
			innerContainer.appendChild(progressText);
			container.appendChild(innerContainer);
			document.body.appendChild(container);

			return {
				setProgress(value) {
					progressValue.innerText = `${value.toFixed(0)}%`;
				},
				destroy() {
					container.remove();
				}
			};
		})();

		try {
			const totalRatingsCount = await (async () => (await fetchData(`/api/users/${userId}`)).ratings_count)();
			const updateProgress = (count = 0) => {
				if (totalRatingsCount && count) setProgress(count / totalRatingsCount * 100);
			};

			const movieContents = await fetchUserContents("movies", updateProgress);
			const tvContents = await fetchUserContents("tv_seasons", updateProgress);

			const allContents = {
				movies: await Promise.all(movieContents.ratings.map(async (content) => {
					const details = await fetchContentDetails(content.content.code);
					return { ...content, content: { ...content.content, ...details } };
				})),
				tv_seasons: await Promise.all(tvContents.ratings.map(async (content) => {
					const details = await fetchContentDetails(content.content.code);
					return { ...content, content: { ...content.content, ...details } };
				}))
			};

			const downloadJSON = (filename, content) => {
				const blob = new window.Blob([JSON.stringify(content, null, 2)], { type: "application/json;charset=utf-8;" });
				const link = document.createElement("a");
				link.href = URL.createObjectURL(blob);
				link.download = filename;
				link.click();
			};

			downloadJSON(`${userId}-watcha.json`, allContents);
		} catch (error) {
			console.error(error);
		}

		destroy();
	})();
}();
