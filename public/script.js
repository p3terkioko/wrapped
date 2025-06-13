// App State
let currentData = null;
let isAuthenticated = false;
let currentSlide = 0;
let totalSlides = 12;

// DOM Elements (get these dynamically to avoid null reference issues)
const landingPage = document.getElementById('landing-page');
const dashboard = document.getElementById('dashboard');
const loadingScreen = document.getElementById('loading-screen');
const themeToggle = document.getElementById('theme-toggle');
const analyzeBtn = document.getElementById('analyze-btn');
const backBtn = document.getElementById('back-btn');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up app...');
    
    setupEventListeners();
    handleURLParams();
    
    // Enable analyze button since we use cached data
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }
    
    // Try to load cached data first
    loadCachedData();
});

// Check authentication status (now simplified)
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();
        isAuthenticated = data.authenticated;
        updateAuthButton();
    } catch (error) {
        console.error('Error checking auth status:', error);
        isAuthenticated = false;
        updateAuthButton();
    }
}

// Update auth button based on status (no longer needed for public access)
function updateAuthButton() {
    // Button is always enabled since we use cached data
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle?.addEventListener('click', toggleTheme);
      // Analyze button - now just triggers showing cached data
    analyzeBtn?.addEventListener('click', function() {
        if (currentData) {
            showDashboard(currentData);
        } else {
            loadCachedData();
        }
    });
    
    // Back button
    backBtn?.addEventListener('click', () => {
        showLandingPage();
    });
      // Story navigation (with null checks) - excluding view story btn which is handled separately
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const exitStoryBtn = document.getElementById('exit-story-btn');
    const shareStoryBtn = document.getElementById('share-story-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', previousSlide);
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', nextSlide);
    }
    if (exitStoryBtn) {
        exitStoryBtn.addEventListener('click', exitStory);
    }
    if (shareStoryBtn) {
        shareStoryBtn.addEventListener('click', shareStory);
    }
    
    // Keyboard navigation for story
    document.addEventListener('keydown', (e) => {
        const storyContainer = document.getElementById('story-container');
        if (storyContainer && !storyContainer.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') previousSlide();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'Escape') exitStory();
        }
    });
      // Share and export buttons
    const shareBtn = document.getElementById('share-btn');
    const exportBtn = document.getElementById('export-btn');
    const advancedAnalyticsBtn = document.getElementById('advanced-analytics-btn');
    
    if (shareBtn) shareBtn.addEventListener('click', shareResults);
    if (exportBtn) exportBtn.addEventListener('click', exportResults);
    if (advancedAnalyticsBtn) {
        advancedAnalyticsBtn.addEventListener('click', () => {
            console.log('🔍 Manual advanced analytics trigger');
            loadAdvancedAnalytics();
        });
    }
}

// Handle URL parameters
function handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const auth = urlParams.get('auth');
    
    if (error) {
        showError('Authentication failed. Please try again.');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (auth === 'success') {
        showSuccess('Successfully logged in with Spotify!');
        checkAuthStatus();
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Authentication functions
function login() {
    window.location.href = '/auth/login';
}

async function logout() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        isAuthenticated = false;
        updateAuthButton();
        showSuccess('Successfully logged out.');
    } catch (error) {
        console.error('Logout error:', error);
        showError('Error logging out. Please try again.');
    }
}

// Theme toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const icon = themeToggle.querySelector('i');
    icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const icon = themeToggle.querySelector('i');
    icon.className = savedTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Validate Spotify playlist URL
function validatePlaylistURL() {
    const url = playlistInput.value.trim();
    const isValid = isValidSpotifyPlaylistURL(url);
    
    if (isValid && isAuthenticated) {
        analyzeBtn.disabled = false;
        playlistInput.style.borderColor = 'var(--accent-primary)';
    } else {
        analyzeBtn.disabled = true;
        playlistInput.style.borderColor = url ? 'var(--error-color, #ff4444)' : 'var(--card-border)';
    }
}

// Check if URL is a valid Spotify playlist URL
function isValidSpotifyPlaylistURL(url) {
    const spotifyPlaylistRegex = /https?:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/;
    return spotifyPlaylistRegex.test(url);
}

// Extract playlist ID from URL
function extractPlaylistId(url) {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// Analyze playlist
async function analyzePlaylist() {
    // Use the hardcoded playlist ID
    const playlistId = '1BZY7mhShLhc2fIlI6uIa4';
    
    if (!isAuthenticated) {
        showError('Please login with Spotify first.');
        return;
    }
    
    showLoading();
    
    try {
        const accessToken = getCookie('spotify_access_token');
        
        const response = await fetch('/api/playlist/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistId: playlistId,
                accessToken: accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to analyze playlist');
        }
        
        const data = await response.json();
        currentData = data;
        
        hideLoading();
        showDashboard(data);
        
    } catch (error) {
        console.error('Analysis error:', error);
        hideLoading();
        showError('Failed to analyze playlist. Please try again.');
    }
}

// Get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Show loading screen
function showLoading() {
    loadingScreen.classList.remove('hidden');
}

// Hide loading screen
function hideLoading() {
    loadingScreen.classList.add('hidden');
}

// Show landing page
function showLandingPage() {
    dashboard.classList.add('hidden');
    landingPage.classList.remove('hidden');
}

// Show dashboard with data
function showDashboard(data) {
    landingPage.classList.add('hidden');
    dashboard.classList.remove('hidden');
    
    populateDashboard(data);
    
    // Ensure story button is working after dashboard is shown
    setTimeout(() => {
        setupViewStoryButton();
    }, 100);
}

// Separate function to setup view story button
function setupViewStoryButton() {
    const viewStoryBtn = document.getElementById('view-story-btn');
    console.log('Setting up view story button:', !!viewStoryBtn);
    
    if (viewStoryBtn) {
        // Remove any existing listeners
        const newBtn = viewStoryBtn.cloneNode(true);
        viewStoryBtn.parentNode.replaceChild(newBtn, viewStoryBtn);
        
        // Add fresh event listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('View Story button clicked!');
            console.log('Current data exists:', !!currentData);
            
            if (currentData) {
                showStory();
            } else {
                alert('No playlist data available!');
            }
        });
        
        console.log('✅ View story button setup complete');
    } else {
        console.log('❌ View story button not found in DOM');
    }
}

// Populate dashboard with playlist data
function populateDashboard(data) {
    // Playlist overview
    document.getElementById('playlist-img').src = data.playlist.image || '/placeholder-playlist.png';
    document.getElementById('playlist-name').textContent = data.playlist.name;
    document.getElementById('playlist-description').textContent = data.playlist.description || 'No description available';
    document.getElementById('total-tracks').textContent = data.playlist.totalTracks.toLocaleString();
    document.getElementById('total-followers').textContent = data.playlist.followers.toLocaleString();
    document.getElementById('playlist-owner').textContent = data.playlist.owner;
    
    // Top artists
    populateArtists(data.topArtists);
    
    // Top contributors
    populateContributors(data.topContributors);
    
    // Most popular track
    populateTrackInfo('popular-track', data.mostPopular, 'Most Popular');
    
    // Hidden gem
    populateTrackInfo('hidden-gem', data.leastPopular, 'Hidden Gem');
      // Timeline
    populateTimeline(data.dateRange);
    
    // Oldest & Newest Songs
    populateOldestNewestSongs(data);
    
    // Charts
    createGenresChart(data.topGenres);
    createMoodChart(data.audioFeatures);    // Load advanced analytics - use existing comprehensive data if available
    if (data.contributors) {
        console.log('✅ Using existing comprehensive contributor analytics');
        console.log('Contributors data structure:', data.contributors);
        console.log('Contributors array length:', data.contributors.contributors?.length || 0);
        populateContributorAnalytics(data.contributors);
    } else {
        console.log('📊 Loading advanced analytics separately...');
        loadAdvancedAnalytics();
    }
    
    // Load genre maestros and playlist members if available in data
    if (data.genreMaestros) {
        console.log('✅ Using existing genre maestros data');
        populateGenreMaestros(data.genreMaestros);
    }
    
    if (data.playlistMembers) {
        console.log('✅ Using existing playlist members data');
        populatePlaylistMembers(data.playlistMembers);
    }
    
    // If not available in main data, load them separately
    if (!data.genreMaestros || !data.playlistMembers) {
        console.log('📊 Loading members and champions separately...');
        loadMembersAndChampions();
    }
}

// Populate artists list
function populateArtists(artists) {
    const container = document.getElementById('artists-list');
    container.innerHTML = '';
    
    artists.forEach((artist, index) => {
        const artistElement = document.createElement('div');
        artistElement.className = 'artist-item';
        artistElement.innerHTML = `
            <span class="artist-name">${index + 1}. ${artist.name}</span>
            <span class="artist-count">${artist.count} tracks</span>
        `;
        container.appendChild(artistElement);
    });
}

// Populate contributors list
function populateContributors(contributors) {
    const container = document.getElementById('contributors-list');
    container.innerHTML = '';
    
    contributors.forEach((contributor, index) => {
        const contributorElement = document.createElement('div');
        contributorElement.className = 'contributor-item';
        contributorElement.innerHTML = `
            <span class="contributor-name">${index + 1}. ${contributor.displayName}</span>
            <span class="contributor-count">${contributor.count} songs</span>
        `;
        container.appendChild(contributorElement);
    });
}

// Populate track info
function populateTrackInfo(containerId, track, type) {
    const container = document.getElementById(containerId);
    
    if (!track) {
        container.innerHTML = '<p>No data available</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="track-name">${track.name}</div>
        <div class="track-artist">${track.artists}</div>
        <div class="track-popularity">${track.popularity}% popularity</div>
        ${track.external_urls?.spotify ? `
            <a href="${track.external_urls.spotify}" target="_blank" class="spotify-link">
                <i class="fab fa-spotify"></i>
                Listen on Spotify
            </a>
        ` : ''}
    `;
}

// Populate timeline
function populateTimeline(dateRange) {
    const container = document.getElementById('timeline-info');
    
    if (!dateRange) {
        container.innerHTML = '<p>No timeline data available</p>';
        return;
    }
    
    const earliest = new Date(dateRange.earliest).toLocaleDateString();
    const latest = new Date(dateRange.latest).toLocaleDateString();
    const duration = Math.ceil((new Date(dateRange.latest) - new Date(dateRange.earliest)) / (1000 * 60 * 60 * 24));
    
    container.innerHTML = `
        <div class="timeline-dates">
            <div class="timeline-date">
                <span class="date-label">First Added</span>
                <span class="date-value">${earliest}</span>
            </div>
            <div class="timeline-date">
                <span class="date-label">Last Added</span>
                <span class="date-value">${latest}</span>
            </div>
        </div>        <div class="timeline-duration">
            Playlist built over ${duration} days
        </div>
    `;
}

// Populate oldest and newest songs
function populateOldestNewestSongs(data) {
    const container = document.getElementById('oldest-newest-info');
    
    if (!container) {
        console.log('oldest-newest-info container not found');
        return;
    }
    
    // Find oldest and newest songs from contributor data
    let oldestSong = null;
    let newestSong = null;
    
    if (data.contributors && data.contributors.contributors) {
        data.contributors.contributors.forEach(contributor => {
            if (contributor.tracks) {
                contributor.tracks.forEach(track => {
                    if (track.releaseDate) {
                        if (!oldestSong || track.releaseDate < oldestSong.releaseDate) {
                            oldestSong = track;
                        }
                        if (!newestSong || track.releaseDate > newestSong.releaseDate) {
                            newestSong = track;
                        }
                    }
                });
            }
        });
    }
    
    if (!oldestSong || !newestSong) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No release date information available</p>';
        return;
    }
    
    const oldestYear = new Date(oldestSong.releaseDate).getFullYear();
    const newestYear = new Date(newestSong.releaseDate).getFullYear();
    const yearSpan = newestYear - oldestYear;
    
    container.innerHTML = `
        <div class="oldest-newest-track oldest">
            <span class="track-type">Oldest Track</span>
            <div class="track-name">${oldestSong.name}</div>
            <div class="track-artist">${oldestSong.artists}</div>
            <span class="track-year">${oldestYear}</span>
        </div>
        <div class="oldest-newest-track newest">
            <span class="track-type">Newest Track</span>
            <div class="track-name">${newestSong.name}</div>
            <div class="track-artist">${newestSong.artists}</div>
            <span class="track-year">${newestYear}</span>
        </div>
    `;
    
    // Add a summary if there's a significant time span
    if (yearSpan > 10) {
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; margin-top: 16px; color: var(--text-secondary); font-size: 14px;';
        summaryDiv.innerHTML = `<i class="fas fa-history"></i> This playlist spans <strong>${yearSpan} years</strong> of musical history`;
        container.appendChild(summaryDiv);
    }
}

// Create genres chart
function createGenresChart(genres) {
    const ctx = document.getElementById('genres-chart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: genres.map(g => g.genre),
            datasets: [{
                data: genres.map(g => g.count),
                backgroundColor: [
                    '#1db954', '#1ed760', '#ff6b6b', '#4ecdc4',
                    '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'var(--text-primary)',
                        usePointStyle: true,
                        padding: 20
                    }
                }
            }
        }
    });
}

// Create mood chart
function createMoodChart(audioFeatures) {
    const ctx = document.getElementById('mood-chart').getContext('2d');
    
    const features = [
        { label: 'Valence', value: audioFeatures.valence },
        { label: 'Energy', value: audioFeatures.energy },
        { label: 'Danceability', value: audioFeatures.danceability },
        { label: 'Acousticness', value: audioFeatures.acousticness },
        { label: 'Speechiness', value: audioFeatures.speechiness }
    ];
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: features.map(f => f.label),
            datasets: [{
                label: 'Playlist Mood',
                data: features.map(f => f.value),
                backgroundColor: 'rgba(29, 185, 84, 0.2)',
                borderColor: '#1db954',
                borderWidth: 2,
                pointBackgroundColor: '#1db954',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        color: 'var(--card-border)'
                    },
                    grid: {
                        color: 'var(--card-border)'
                    },
                    pointLabels: {
                        color: 'var(--text-primary)'
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        backdropColor: 'transparent'
                    },
                    min: 0,
                    max: 1
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--text-primary)'
                    }
                }
            }
        }    });
}

// Populate advanced analytics sections
function populateAdvancedAnalytics(analyticsData) {
    if (!analyticsData) return;
      // Populate contributor analytics
    if (analyticsData.contributors) {
        populateContributorAnalytics(analyticsData.contributors);
    }
}

function populateContributorAnalytics(contributorData) {
    console.log('🔍 populateContributorAnalytics called with:', contributorData);
    
    // Temporary debugging - show structure
    if (contributorData && contributorData.contributors && contributorData.contributors.length > 0) {
        const firstContributor = contributorData.contributors[0];
        console.log('✅ First contributor found:', firstContributor.name, 'with', firstContributor.tracksAdded, 'tracks');
    } else {
        console.log('❌ No valid contributors found in data');
        console.log('contributorData:', contributorData);
    }
    
    const container = document.getElementById('contributor-analytics');
    if (!container) {
        console.log('❌ contributor-analytics container not found');
        return;
    }
    
    // contributorData is the full analytics object with contributors array inside
    const contributors = contributorData.contributors || [];
    console.log('📊 Contributors array:', contributors);
    console.log('📊 First contributor:', contributors[0]);
    
    const totalTracks = contributors.reduce((sum, c) => sum + (c.tracksAdded || 0), 0);
    console.log('📊 Total tracks from contributors:', totalTracks);
    
    container.innerHTML = `
        <div class="contributor-leaderboard">            ${contributors.slice(0, 8).map((contributor, index) => {
                const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
                const isTop = index < 3;
                const tracksAdded = contributor.tracksAdded || 0;
                const percentage = totalTracks > 0 ? Math.round((tracksAdded / totalTracks) * 100) : 0;
                
                return `
                    <div class="contributor-leader ${isTop ? 'top' : ''}">
                        <div class="contributor-info">
                            <div class="contributor-rank ${rankClass}">${index + 1}</div>
                            <div class="contributor-details">
                                <div class="contributor-name">${contributor.name || 'Unknown User'}</div>
                                <div class="contributor-stats">
                                    <div class="stat-item">
                                        <span class="stat-value">${tracksAdded}</span>
                                        <span class="stat-label">songs</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-value">${percentage}%</span>
                                        <span class="stat-label">of playlist</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-value">${contributor.genreDiversity || 0}</span>
                                        <span class="stat-label">genres</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-value">${Math.round(contributor.avgPopularity || 0)}</span>
                                        <span class="stat-label">avg popularity</span>
                                    </div>
                                </div>
                                ${contributor.badges && contributor.badges.length > 0 ? `
                                    <div class="contributor-badges">
                                        ${contributor.badges.map(badge => `
                                            <span class="badge special" title="${badge.description}">
                                                ${badge.name}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${contributor.avgAudioFeatures && (
                                    contributor.avgAudioFeatures.energy > 0 || 
                                    contributor.avgAudioFeatures.danceability > 0 || 
                                    contributor.avgAudioFeatures.valence > 0
                                ) ? `
                                    <div class="contributor-audio-features">
                                        <div class="audio-feature-bar">
                                            <span class="feature-label">⚡ Energy</span>
                                            <div class="feature-bar">
                                                <div class="feature-fill" style="width: ${contributor.avgAudioFeatures.energy * 100}%"></div>
                                            </div>
                                            <span class="feature-value">${Math.round(contributor.avgAudioFeatures.energy * 100)}%</span>
                                        </div>
                                        <div class="audio-feature-bar">
                                            <span class="feature-label">💃 Dance</span>
                                            <div class="feature-bar">
                                                <div class="feature-fill" style="width: ${contributor.avgAudioFeatures.danceability * 100}%"></div>
                                            </div>
                                            <span class="feature-value">${Math.round(contributor.avgAudioFeatures.danceability * 100)}%</span>
                                        </div>
                                        <div class="audio-feature-bar">
                                            <span class="feature-label">🌈 Mood</span>
                                            <div class="feature-bar">
                                                <div class="feature-fill" style="width: ${contributor.avgAudioFeatures.valence * 100}%"></div>
                                            </div>
                                            <span class="feature-value">${Math.round(contributor.avgAudioFeatures.valence * 100)}%</span>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        ${contributorData.summary ? `
            <div class="contributor-summary">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.totalContributors}</span>
                        <span class="summary-label">Total Contributors</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.summary.avgContribution}</span>
                        <span class="summary-label">Avg Songs/Person</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.summary.totalGenres}</span>
                        <span class="summary-label">Total Genres</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.summary.totalArtists || 0}</span>
                        <span class="summary-label">Total Artists</span>
                    </div>
                </div>                <div class="summary-highlight">
                    <i class="fas fa-crown"></i>
                    <span>Most Active: <strong>${contributorData.summary.mostActive}</strong></span>
                </div>
            </div>
        ` : ''}
        
        <!-- Badge Legend -->
        <div class="badge-legend">
            <div class="legend-header">
                <h4><i class="fas fa-info-circle"></i> Badge Guide</h4>
                <p>Understanding contributor achievements</p>
            </div>
            <div class="legend-grid">
                <div class="legend-category">
                    <h5>🏆 Contribution Badges</h5>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="badge-preview">🔥 Top Curator</span>
                            <span class="badge-description">Added the most tracks to this playlist</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">🧠 Eclectic Ear</span>
                            <span class="badge-description">Most diverse taste with widest genre spread</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">🎖️ Genre Guru</span>
                            <span class="badge-description">Master of a specific genre</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">📀 Collector</span>
                            <span class="badge-description">Music explorer with most unique artists</span>
                        </div>
                    </div>
                </div>
                
                <div class="legend-category">
                    <h5>🔍 Discovery Badges</h5>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="badge-preview">🌚 Underground Hero</span>
                            <span class="badge-description">Discovers hidden gems with low popularity</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">📈 Trendsetter</span>
                            <span class="badge-description">Early adopter of tracks before they're popular</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">💿 Old Soul</span>
                            <span class="badge-description">Loves classics with oldest average release year</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">🆕 Fresh Dropper</span>
                            <span class="badge-description">Always current with newest releases</span>
                        </div>
                    </div>
                </div>
                
                <div class="legend-category">
                    <h5>🎵 Vibe Badges</h5>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="badge-preview">⚡ Energy Dealer</span>
                            <span class="badge-description">High-energy music curator</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">💃 Dancefloor Commander</span>
                            <span class="badge-description">Makes everyone move with danceable tracks</span>
                        </div>
                        <div class="badge-preview">🌈 Vibes Master</div>
                        <div class="badge-description">Spreads positive energy with uplifting songs</div>
                        <div class="legend-item">
                            <span class="badge-preview">🌧️ Sad Boi</span>
                            <span class="badge-description">Embraces melancholy with emotional tracks</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Share results
function shareResults() {
    if (!currentData) return;
    
    const shareText = `Check out my Playlist Wrapped for "${currentData.playlist.name}"! 🎵\n\nTop Artist: ${currentData.topArtists[0]?.name}\nMost Popular Track: ${currentData.mostPopular?.name}\n\nAnalyze your own playlists at: ${window.location.origin}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'My Playlist Wrapped',
            text: shareText,
            url: window.location.origin
        });
    } else {
        // Fallback - copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showSuccess('Share text copied to clipboard!');
        }).catch(() => {
            showError('Failed to copy share text.');
        });
    }
}

// Export results (basic implementation)
function exportResults() {
    if (!currentData) return;
    
    const dataStr = JSON.stringify(currentData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentData.playlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_wrapped.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showSuccess('Playlist data exported successfully!');
}

// Utility functions for notifications
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        backgroundColor: type === 'success' ? '#1db954' : '#ff4444'
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Story Experience Functions
function showStory() {
    console.log('=== showStory called ===');
    console.log('currentData exists:', !!currentData);
    
    if (!currentData) {
        console.log('No currentData available');
        alert('No playlist data available!');
        return;
    }
    
    const storyContainer = document.getElementById('story-container');
    const storySlides = document.getElementById('story-slides');
    
    console.log('storyContainer found:', !!storyContainer);
    console.log('storySlides found:', !!storySlides);
    
    if (!storyContainer) {
        console.log('storyContainer not found');
        alert('Story container not found in DOM');
        return;
    }
    
    console.log('Generating story slides...');
    currentSlide = 0;
    generateStorySlides(currentData);    console.log('Showing story container...');
    storyContainer.classList.remove('hidden');
    dashboard.classList.add('hidden');
    
    console.log('Updating progress and showing first slide...');
    updateStoryProgress();
    showSlide(0);
    
    console.log('Setting up story navigation...');
    setupStoryNavigation();
    
    console.log('=== Story setup complete ===');
}

function exitStory() {
    console.log('Exiting story...');
    
    const storyContainer = document.getElementById('story-container');
    if (storyContainer) {
        storyContainer.classList.add('hidden');
        dashboard.classList.remove('hidden');
        console.log('✅ Returned to dashboard');
    }
}

function setupStoryNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const exitStoryBtn = document.getElementById('exit-story-btn');
    const shareStoryBtn = document.getElementById('share-story-btn');
    
    if (prevBtn) {
        prevBtn.onclick = previousSlide;
    }
    if (nextBtn) {
        nextBtn.onclick = nextSlide;
    }
    if (exitStoryBtn) {
        exitStoryBtn.onclick = exitStory;
    }
    if (shareStoryBtn) {
        shareStoryBtn.onclick = shareStory;
    }
    
    console.log('Story navigation setup complete');
}

function generateStorySlides(data) {    const slides = [
        generateWelcomeSlide(data),
        generateOverviewSlide(data),
        generateGenreJourneySlide(data),
        generateGenreBreakdownSlide(data),
        generateTopArtistsSlide(data),
        generatePopularTrackSlide(data),
        generatePopularityExplanationSlide(data),
        generateHiddenGemSlide(data),
        generateContributorsSlide(data),
        generateMoodSlide(data),
        generateTimelineSlide(data),
        generateFinalSlide(data)
    ];
    
    const storySlides = document.getElementById('story-slides');
    if (storySlides) {
        storySlides.innerHTML = slides.join('');
    }
}

function generateWelcomeSlide(data) {
    return `
        <div class="story-slide">
            <h1>🎉 Unwrap Your Playlist Wrapped!</h1>
            <p>Get ready to discover the hidden stories in <span class="highlight">${data.playlist.name}</span></p>
            <div class="story-visual">
                <img src="${data.playlist.image || '/placeholder-playlist.png'}" 
                     alt="Playlist cover" 
                     style="width: 200px; height: 200px; border-radius: 12px; object-fit: cover;">
            </div>
        </div>
    `;
}

function generateOverviewSlide(data) {
    const hours = Math.floor(data.playlist.totalTracks * 3.5 / 60); // Approximate duration
    return `
        <div class="story-slide">
            <h2>This playlist has</h2>
            <span class="big-number">${data.playlist.totalTracks}</span>
            <p>songs, running approximately <span class="highlight">${hours} hours</span> of music</p>
            <div class="story-visual">
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <div style="font-size: 2rem; color: var(--accent-primary);">${data.playlist.totalTracks}</div>
                        <div style="color: var(--text-secondary);">Tracks</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; color: var(--accent-primary);">${data.playlist.followers}</div>
                        <div style="color: var(--text-secondary);">Followers</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateGenreJourneySlide(data) {
    const genreCount = data.topGenres.length;
    return `
        <div class="story-slide">
            <h2>This playlist traveled through</h2>
            <span class="big-number">${genreCount}</span>
            <p>different genres...</p>
            <div class="story-visual">
                <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                    ${data.topGenres.slice(0, 8).map(genre => 
                        `<span style="background: var(--card-bg); padding: 8px 16px; border-radius: 20px; color: var(--text-primary); border: 1px solid var(--card-border);">
                            ${genre.genre}
                        </span>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;
}

function generateGenreBreakdownSlide(data) {
    const topThree = data.topGenres.slice(0, 3);
    const total = topThree.reduce((sum, g) => sum + g.count, 0);
    
    return `
        <div class="story-slide">
            <h2>But it found its home in</h2>
            <div class="story-visual">
                ${topThree.map((genre, index) => {
                    const percentage = Math.round((genre.count / total) * 100);
                    const colors = ['#1db954', '#ff6b6b', '#4ecdc4'];
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin: 16px 0; padding: 12px; background: var(--card-bg); border-radius: 8px;">
                            <span style="color: ${colors[index]}; font-weight: 600;">${genre.genre}</span>
                            <span style="color: var(--text-primary); font-weight: 600;">${percentage}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function generateTopArtistsSlide(data) {
    return `
        <div class="story-slide">
            <h2>These artists made the biggest waves</h2>
            <div class="story-visual">
                <div class="story-list">
                    ${data.topArtists.slice(0, 5).map((artist, index) => `
                        <div class="story-list-item">
                            <div>
                                <span style="color: var(--accent-primary); margin-right: 8px;">#${index + 1}</span>
                                <span class="name">${artist.name}</span>
                            </div>
                            <span class="count">${artist.count} songs</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function generatePopularTrackSlide(data) {
    if (!data.mostPopular) {
        return `
            <div class="story-slide">
                <h2>No popularity data available</h2>
                <p>But every song is a hit in our hearts! 💕</p>
            </div>
        `;
    }
      return `
        <div class="story-slide">
            <h2>The crowd favorite was</h2>
            <div class="track-spotlight">
                <div class="track-info">
                    <div class="track-name">"${data.mostPopular.name}"</div>
                    <div class="track-artist">by ${data.mostPopular.artists}</div>
                    <div>Popularity Score: <span class="highlight">${data.mostPopular.popularity}/100</span></div>
                    <div class="popularity-gauge">
                        <div class="popularity-fill" style="width: ${data.mostPopular.popularity}%"></div>
                    </div>
                </div>
            </div>
            <p style="margin-top: 20px; color: var(--text-secondary); font-size: 0.9rem;">
                But what does that number actually mean? 🤔
            </p>
        </div>
    `;
}

function generatePopularityExplanationSlide(data) {
    const avgPopularity = data.topContributors && data.topContributors.length > 0 
        ? Math.round(data.topContributors.reduce((sum, c) => sum + (c.avgPopularity || 0), 0) / data.topContributors.length)
        : 50;
    
    const mostPopular = data.mostPopular ? data.mostPopular.popularity : 0;
    const leastPopular = data.leastPopular ? data.leastPopular.popularity : 0;
    
    return `
        <div class="story-slide">
            <h2>Understanding the Popularity Scale</h2>
            <div class="story-visual">
                <p style="margin-bottom: 24px; color: var(--text-secondary);">
                    Spotify's popularity score (0-100) shows how trending a track is right now
                </p>
                
                <div style="display: flex; flex-direction: column; gap: 16px; margin: 20px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,107,107,0.1); border-radius: 8px; border-left: 4px solid #ff6b6b;">
                        <span style="font-weight: 600;">🔥 Viral Hits</span>
                        <span style="color: var(--text-secondary);">80-100</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(78,205,196,0.1); border-radius: 8px; border-left: 4px solid #4ecdc4;">
                        <span style="font-weight: 600;">📈 Popular</span>
                        <span style="color: var(--text-secondary);">60-79</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(69,183,209,0.1); border-radius: 8px; border-left: 4px solid #45b7d1;">
                        <span style="font-weight: 600;">🎵 Moderate</span>
                        <span style="color: var(--text-secondary);">40-59</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(249,202,36,0.1); border-radius: 8px; border-left: 4px solid #f9ca24;">
                        <span style="font-weight: 600;">💎 Underground</span>
                        <span style="color: var(--text-secondary);">20-39</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(165,94,234,0.1); border-radius: 8px; border-left: 4px solid #a55eea;">
                        <span style="font-weight: 600;">🌚 Deep Cuts</span>
                        <span style="color: var(--text-secondary);">0-19</span>
                    </div>
                </div>
                
                <div style="margin-top: 24px; padding: 16px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px;">
                        ${mostPopular > 0 ? `
                            <div>
                                <div style="font-size: 1.5rem; color: var(--accent-primary); font-weight: 600;">${mostPopular}</div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Your Highest</div>
                            </div>
                        ` : ''}
                        ${leastPopular > 0 ? `
                            <div>
                                <div style="font-size: 1.5rem; color: var(--accent-secondary); font-weight: 600;">${leastPopular}</div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">Your Lowest</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateHiddenGemSlide(data) {
    if (!data.leastPopular) {
        return `
            <div class="story-slide">
                <h2>Every song here is perfectly curated</h2>
                <p>No hidden gems needed when everything sparkles! ✨</p>
            </div>
        `;
    }
    
    return `
        <div class="story-slide">
            <h2>But our biggest hidden gem was</h2>
            <div class="track-spotlight" style="background: var(--bg-secondary); border: 2px solid var(--accent-secondary);">
                <div class="track-info">
                    <div class="track-name">"${data.leastPopular.name}"</div>
                    <div class="track-artist">by ${data.leastPopular.artists}</div>
                    <div>The most underrated pick</div>
                    <div class="popularity-gauge">
                        <div class="popularity-fill" style="width: ${data.leastPopular.popularity}%; background: var(--accent-secondary);"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateContributorsSlide(data) {
    return `
        <div class="story-slide">
            <h2>Shout-out to our top contributors</h2>
            <div class="story-visual">
                <div class="story-list">
                    ${data.topContributors.slice(0, 5).map((contributor, index) => `
                        <div class="story-list-item">
                            <div>
                                <span style="color: var(--accent-primary); margin-right: 8px;">#${index + 1}</span>
                                <span class="name">${contributor.displayName}</span>
                            </div>
                            <span class="count">${contributor.count} songs</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function generateMoodSlide(data) {
    const features = data.audioFeatures;
    const energy = Math.round(features.energy * 100);
    const danceability = Math.round(features.danceability * 100);
    const valence = Math.round(features.valence * 100);
    
    return `
        <div class="story-slide">
            <h2>Overall Vibe Check</h2>
            <div class="story-visual">
                <div style="display: grid; gap: 16px; margin: 20px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Energetic</span>
                        <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 12px;">
                            <div style="width: ${energy}%; height: 100%; background: var(--gradient-primary); border-radius: 4px;"></div>
                        </div>
                        <span class="highlight">${energy}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Danceable</span>
                        <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 12px;">
                            <div style="width: ${danceability}%; height: 100%; background: var(--gradient-primary); border-radius: 4px;"></div>
                        </div>
                        <span class="highlight">${danceability}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Happy</span>
                        <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 12px;">
                            <div style="width: ${valence}%; height: 100%; background: var(--gradient-primary); border-radius: 4px;"></div>
                        </div>
                        <span class="highlight">${valence}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateTimelineSlide(data) {
    if (!data.dateRange || !data.dateRange.earliest || !data.dateRange.latest) {
        return `
            <div class="story-slide">
                <h2>This playlist is timeless</h2>
                <p>Like all great music collections! 🕰️</p>
            </div>
        `;
    }
    
    // Ensure dates are Date objects
    const earliestDate = new Date(data.dateRange.earliest);
    const latestDate = new Date(data.dateRange.latest);
    
    const startYear = earliestDate.getFullYear();
    const endYear = latestDate.getFullYear();
    const yearSpan = endYear - startYear;
    
    return `
        <div class="story-slide">
            <h2>Here's when the magic happened</h2>
            <div class="story-visual">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 16px;">
                        <span class="highlight">${startYear}</span> → <span class="highlight">${endYear}</span>
                    </div>
                    <p>This collection grew over <span class="highlight">${yearSpan || 1} year${yearSpan !== 1 ? 's' : ''}</span></p>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        From ${earliestDate.toLocaleDateString()} to ${latestDate.toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    `;
}

function generateFinalSlide(data) {
    return `
        <div class="story-slide">
            <h1>That's Your Playlist Wrapped! 🎉</h1>
            <p>You've discovered the musical DNA of <span class="highlight">${data.playlist.name}</span></p>
            <div class="story-visual">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; text-align: center;">
                    <div style="padding: 16px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--card-border);">
                        <div style="font-size: 1.5rem; color: var(--accent-primary);">${data.playlist.totalTracks}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Total Tracks</div>
                    </div>
                    <div style="padding: 16px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--card-border);">
                        <div style="font-size: 1.5rem; color: var(--accent-primary);">${data.topGenres.length}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Genres</div>
                    </div>                    <div style="padding: 16px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--card-border);">
                        <div style="font-size: 1.5rem; color: var(--accent-primary);">${data.totalUniqueArtists || data.topArtists.length}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Artists</div>
                    </div>
                    <div style="padding: 16px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--card-border);">
                        <div style="font-size: 1.5rem; color: var(--accent-primary);">${data.totalAnalyzedTracks || 0}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Analyzed</div>
                    </div>
                </div>
            </div>
            <p style="margin-top: 32px;">Ready to share your story?</p>
        </div>
    `;
}

function showSlide(index) {
    const slides = document.querySelectorAll('.story-slide');
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const shareStoryBtn = document.getElementById('share-story-btn');
    
    if (prevBtn) {
        prevBtn.disabled = index === 0;
    }
    if (nextBtn) {
        nextBtn.style.display = index === totalSlides - 1 ? 'none' : 'flex';
    }
    if (shareStoryBtn) {
        shareStoryBtn.style.display = index === totalSlides - 1 ? 'flex' : 'none';
    }
    
    updateStoryProgress();
}

function nextSlide() {
    if (currentSlide < totalSlides - 1) {
        currentSlide++;
        showSlide(currentSlide);
    }
}

function previousSlide() {
    if (currentSlide > 0) {
        currentSlide--;
        showSlide(currentSlide);
    }
}

function updateStoryProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    const progress = ((currentSlide + 1) / totalSlides) * 100;
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    if (progressText) {
        progressText.textContent = `${currentSlide + 1} / ${totalSlides}`;
    }
}

function shareStory() {
    if (navigator.share) {
        navigator.share({
            title: 'My Playlist Wrapped',
            text: `Check out my ${currentData.playlist.name} Wrapped! 🎵`,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(`Check out my ${currentData.playlist.name} Wrapped! 🎵 ${window.location.href}`);
        showSuccess('Link copied to clipboard!');
    }
}

// Load cached data from public endpoint
async function loadCachedData() {
    try {
        console.log('Attempting to load cached data...');
        const response = await fetch('/api/public/data');
          if (response.ok) {
            const result = await response.json();
            currentData = result.data;
            console.log('✅ Cached data loaded successfully:', currentData.playlist.name);
            
            // Update hero subtitle with actual track count
            const heroSubtitle = document.querySelector('.hero-subtitle');
            if (heroSubtitle && currentData.playlist.totalTracks) {
                heroSubtitle.innerHTML = `
                    Discover the hidden stories and musical insights from this amazing playlist
                    with ${currentData.playlist.totalTracks} tracks of diverse genres and artists.
                `;
            }
            
            // Don't auto-show dashboard - let user click "Dive In"
            // Just store the data and keep showing landing page
            console.log(`Data available - user can now click "Dive In"`);
            
            // Update last updated info
            const lastUpdated = new Date(result.lastUpdated).toLocaleString();
            console.log(`Data last updated: ${lastUpdated}`);
            
        } else {
            console.log('No cached data available - showing landing page');
            currentData = null;
        }
        
        // Always show landing page first
        showLandingPage();
        
    } catch (error) {
        console.error('Error loading cached data:', error);
        currentData = null;
        showLandingPage();
    }
}

// Load theme on page load
loadTheme();

// Advanced Analytics Functions
async function loadAdvancedAnalytics() {
    if (!currentData) {
        console.log('No playlist data available for advanced analytics');
        return;
    }
    
    const playlistId = '1BZY7mhShLhc2fIlI6uIa4';
    
    try {
        console.log('🔍 Loading advanced analytics...');
        
        // Show loading indicators
        showAdvancedAnalyticsLoading();
        
        // Load all advanced analytics in parallel
        const [contributorsData, languagesData, geographyData] = await Promise.all([
            loadContributorAnalytics(playlistId),
            loadLanguageAnalytics(playlistId),
            loadGeographicAnalytics(playlistId)
        ]);
        
        // Store in global state
        currentData.advancedAnalytics = {
            contributors: contributorsData,
            languages: languagesData,
            geography: geographyData
        };
        
        // Update dashboard with advanced features
        populateAdvancedAnalytics(currentData.advancedAnalytics);
        
        console.log('✅ Advanced analytics loaded successfully');
        
    } catch (error) {
        console.error('Error loading advanced analytics:', error);
        showNotification('Could not load advanced analytics', 'error');
    }
}

function showAdvancedAnalyticsLoading() {
    // Show loading indicators in each section
    const sections = [
        'contributor-analytics',
        'language-summary', 
        'geographic-summary'
    ];
    
    sections.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading analytics...</div>';
        }
    });
}

async function loadContributorAnalytics(playlistId) {
    const response = await fetch('/api/public/data');
    if (response.ok) {
        const result = await response.json();
        return generateClientSideContributorAnalytics(result.data);
    }
    throw new Error('Failed to load contributor analytics');
}

async function loadLanguageAnalytics(playlistId) {
    const response = await fetch('/api/public/data');
    if (response.ok) {
        const result = await response.json();
        return generateClientSideLanguageAnalytics(result.data);
    }
    throw new Error('Failed to load language analytics');
}

async function loadGeographicAnalytics(playlistId) {
    const response = await fetch('/api/public/data');
    if (response.ok) {
        const result = await response.json();
        return generateClientSideGeographicAnalytics(result.data);
    }
    throw new Error('Failed to load geographic analytics');
}

// Client-side analytics generation (using cached data)
function generateClientSideContributorAnalytics(data) {
    const contributors = data.topContributors || [];
    
    // Enhanced contributor data with badges
    const enhancedContributors = contributors.map((contributor, index) => {
        const badges = [];
        
        // Assign badges based on contribution patterns
        if (index === 0 && contributor.count >= 10) {
            badges.push({
                id: 'top_curator',
                name: '🔥 Top Curator',
                description: 'Added the most songs to this playlist'
            });
        }
        
        if (contributor.count >= 20) {
            badges.push({
                id: 'prolific',
                name: '🎵 Prolific Contributor',
                description: 'Added many songs to this playlist'
            });
        }
        
        if (contributor.count >= 5 && contributor.count <= 15) {
            badges.push({
                id: 'underground_hero',
                name: '🌚 Underground Hero',
                description: 'Added quality underground tracks'
            });
        }
        
        // Genre diversity badge (simplified)
        if (data.topGenres && data.topGenres.length >= 5) {
            badges.push({
                id: 'genre_guru',
                name: '🎖️ Genre Guru',
                description: 'Contributed to playlist diversity'
            });
        }
        
        return {
            ...contributor,
            badges,
            percentage: Math.round((contributor.count / data.playlist.totalTracks) * 100)
        };
    });
      return {
        totalContributors: contributors.length,
        contributors: enhancedContributors,
        summary: {
            mostActive: contributors[0]?.displayName || 'Unknown',
            avgContribution: Math.round(data.playlist.totalTracks / Math.max(contributors.length, 1)),
            totalGenres: data.topGenres?.length || 0
        }
    };
}

function generateClientSideLanguageAnalytics(data) {
    // Simple language detection based on artist names and genres
    const languages = {};
    
    // Analyze top genres for language patterns
    (data.topGenres || []).forEach(genre => {
        const lang = detectLanguageFromGenre(genre.genre);
        languages[lang] = (languages[lang] || 0) + genre.count;
    });
    
    // Analyze artist names
    (data.topArtists || []).forEach(artist => {
        const lang = detectLanguageFromName(artist.name);
        languages[lang] = (languages[lang] || 0) + 1;
    });
    
    const languageArray = Object.entries(languages)
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count);
    
    return {
        totalSamples: Object.values(languages).reduce((sum, count) => sum + count, 0),
        languages: languageArray,
        summary: {
            primaryLanguage: languageArray[0]?.language || 'English',
            languageCount: languageArray.length,
            diversity: languageArray.length / Math.max(languageArray.length, 1)
        }
    };
}

function generateClientSideGeographicAnalytics(data) {
    const countries = {};
    
    // Analyze based on genres to determine countries
    (data.topGenres || []).forEach(genre => {
        const country = getCountryFromGenre(genre.genre);
        if (!countries[country]) {
            countries[country] = {
                country,
                count: 0,
                genres: [],
                artists: []
            };
        }
        countries[country].count += genre.count;
        countries[country].genres.push(genre.genre);
    });
    
    // Also analyze artist names for additional country clues
    (data.topArtists || []).forEach(artist => {
        const country = getCountryFromArtistName(artist.name);
        if (country && country !== 'Unknown') {
            if (!countries[country]) {
                countries[country] = {
                    country,
                    count: 0,
                    genres: [],
                    artists: []
                };
            }
            countries[country].count += artist.count;
            countries[country].artists.push(artist.name);
        }
    });
    
    const countryArray = Object.values(countries)
        .sort((a, b) => b.count - a.count);
    
    return {
        totalCountries: countryArray.length,
        countries: countryArray,
        summary: {
            topCountry: countryArray[0]?.country || 'Unknown',
            globalSpread: countryArray.length,
            totalTracks: data.playlist.totalTracks
        }
    };
}

function detectLanguageFromGenre(genre) {
    const lowerGenre = genre.toLowerCase();
    
    if (lowerGenre.includes('afro') || lowerGenre.includes('amapiano') || 
        lowerGenre.includes('gengetone') || lowerGenre.includes('gqom')) {
        return 'African Languages';
    }
    
    if (lowerGenre.includes('latin') || lowerGenre.includes('reggaeton') || 
        lowerGenre.includes('salsa') || lowerGenre.includes('bachata')) {
        return 'Spanish';
    }
    
    if (lowerGenre.includes('k-pop') || lowerGenre.includes('korean')) {
        return 'Korean';
    }
    
    return 'English';
}

function detectLanguageFromName(name) {
    // Simple pattern matching for artist names
    const lowerName = name.toLowerCase();
    
    // African name patterns
    if (/\b(wa|ma|ka|na|ndi|mtu|bem|wel|ose|eko|ike|chi|oba)\b/.test(lowerName)) {
        return 'African Languages';
    }
    
    // Spanish name patterns
    if (/\b(carlos|maria|jose|juan|ana|luis|pedro|carmen|antonio)\b/.test(lowerName)) {
        return 'Spanish';
    }
      return 'English';
}

function getCountryFromArtistName(artistName) {
    const lowerName = artistName.toLowerCase();
    
    // Kenyan artists (common names and known artists)
    if (['nyashinski', 'bien', 'sauti sol', 'khaligraph jones', 'king kaka', 'otile brown', 
         'akothee', 'victoria kimani', 'fena gitu', 'wahu', 'nameless', 'redsan',
         'octopizzo', 'mejja', 'jua cali', 'nonini', 'prezzo', 'lady s'].some(name => lowerName.includes(name))) {
        return 'Kenya';
    }
    
    // Nigerian artists (Afrobeats stars)
    if (['wizkid', 'davido', 'burna boy', 'tiwa savage', 'yemi alade', 'tekno', 'mr eazi',
         'adekunle gold', 'simi', 'falz', 'olamide', 'phyno', 'ice prince', 'wande coal',
         'banky w', 'flavour', 'patoranking', 'runtown', 'kizz daniel'].some(name => lowerName.includes(name))) {
        return 'Nigeria';
    }
    
    // South African artists
    if (['black coffee', 'nasty c', 'sjava', 'anatii', 'kwesta', 'cassper nyovest',
         'aka', 'lady zamar', 'shekhinah', 'trevor noah', 'masters kmd', 'sun-el musician',
         'focalistic', 'major league djz', 'kabza de small', 'dj maphorisa'].some(name => lowerName.includes(name))) {
        return 'South Africa';
    }
    
    // Ghanaian artists
    if (['sarkodie', 'shatta wale', 'stonebwoy', 'r2bees', 'efya', 'becca', 'kwesi arthur',
         'medikal', 'joey b', 'edem', 'manifest', 'wanlov'].some(name => lowerName.includes(name))) {
        return 'Ghana';
    }
    
    // American artists (Hip-hop, R&B, Pop)
    if (['eminem', 'kanye west', 'j. cole', 'drake', 'kendrick lamar', 'jay-z', 'beyoncé',
         'rihanna', 'travis scott', 'cardi b', 'megan thee stallion', 'doja cat', 'lil wayne',
         'nicki minaj', 'future', 'post malone', 'ariana grande', 'taylor swift'].some(name => lowerName.includes(name))) {
        return 'United States';
    }
    
    // UK artists
    if (['coldplay', 'ed sheeran', 'adele', 'sam smith', 'dua lipa', 'harry styles',
         'stormzy', 'skepta', 'dave', 'little mix', 'one direction'].some(name => lowerName.includes(name))) {
        return 'United Kingdom';
    }
    
    // Irish artists
    if (['hozier', 'u2', 'sinead o\'connor', 'the cranberries', 'van morrison'].some(name => lowerName.includes(name))) {
        return 'Ireland';
    }
    
    // Canadian artists
    if (['the weeknd', 'justin bieber', 'shawn mendes', 'avril lavigne', 'celine dion',
         'alanis morissette', 'nickelback', 'arcade fire'].some(name => lowerName.includes(name))) {
        return 'Canada';
    }
    
    return 'Unknown';
}

function getCountryFromGenre(genre) {
    const lowerGenre = genre.toLowerCase();
    
    // African countries - more specific mapping
    if (lowerGenre.includes('gengetone') || lowerGenre.includes('kapuka')) {
        return 'Kenya';
    }
    
    if (lowerGenre.includes('afrobeats') || lowerGenre.includes('yoruba') || 
        lowerGenre.includes('hausa') || lowerGenre.includes('igbo')) {
        return 'Nigeria';
    }
    
    if (lowerGenre.includes('amapiano') || lowerGenre.includes('gqom') || 
        lowerGenre.includes('kwaito') || lowerGenre.includes('maskandi')) {
        return 'South Africa';
    }
    
    if (lowerGenre.includes('highlife') || lowerGenre.includes('hiplife') || 
        lowerGenre.includes('azonto') || lowerGenre.includes('akan')) {
        return 'Ghana';
    }
    
    if (lowerGenre.includes('bongo') || lowerGenre.includes('taarab') || 
        lowerGenre.includes('singeli')) {
        return 'Tanzania';
    }
    
    if (lowerGenre.includes('coupé-décalé') || lowerGenre.includes('zouglou')) {
        return 'Ivory Coast';
    }
    
    if (lowerGenre.includes('mbalax') || lowerGenre.includes('wolof')) {
        return 'Senegal';
    }
    
    // If it's general African but can't be more specific
    if (lowerGenre.includes('afro') && !lowerGenre.includes('afro-cuban')) {
        return 'Kenya'; // Default to Kenya since playlist has many Kenyan artists
    }
    
    // Latin American countries
    if (lowerGenre.includes('reggaeton') || lowerGenre.includes('dembow')) {
        return 'Puerto Rico';
    }
    
    if (lowerGenre.includes('cumbia') || lowerGenre.includes('vallenato')) {
        return 'Colombia';
    }
    
    if (lowerGenre.includes('bachata') || lowerGenre.includes('merengue')) {
        return 'Dominican Republic';
    }
    
    if (lowerGenre.includes('mariachi') || lowerGenre.includes('ranchera')) {
        return 'Mexico';
    }
    
    if (lowerGenre.includes('samba') || lowerGenre.includes('bossa nova') || 
        lowerGenre.includes('funk carioca')) {
        return 'Brazil';
    }
    
    if (lowerGenre.includes('tango')) {
        return 'Argentina';
    }
    
    // Asian countries
    if (lowerGenre.includes('k-pop') || lowerGenre.includes('korean')) {
        return 'South Korea';
    }
    
    if (lowerGenre.includes('j-pop') || lowerGenre.includes('japanese')) {
        return 'Japan';
    }
    
    if (lowerGenre.includes('bollywood') || lowerGenre.includes('hindi') || 
        lowerGenre.includes('bhangra')) {
        return 'India';
    }
    
    // European countries
    if (lowerGenre.includes('uk') || lowerGenre.includes('british') || 
        lowerGenre.includes('grime') || lowerGenre.includes('dubstep')) {
        return 'United Kingdom';
    }
    
    if (lowerGenre.includes('french') || lowerGenre.includes('chanson')) {
        return 'France';
    }
    
    if (lowerGenre.includes('german') || lowerGenre.includes('krautrock')) {
        return 'Germany';
    }
    
    // North American countries
    if (lowerGenre.includes('hip hop') || lowerGenre.includes('rap') || 
        lowerGenre.includes('country') || lowerGenre.includes('blues') || 
        lowerGenre.includes('jazz') || lowerGenre.includes('r&b')) {
        return 'United States';
    }
    
    if (lowerGenre.includes('indie rock') || lowerGenre.includes('alternative')) {
        return 'Canada';
    }
    
    return 'Unknown';
}

// Populate genre maestros section
function populateGenreMaestros(genreMaestros) {
    const container = document.getElementById('genre-maestros');
    if (!container || !genreMaestros || genreMaestros.length === 0) {
        if (container) {
            container.innerHTML = '<p class="no-data">No genre maestros found</p>';
        }
        return;
    }

    console.log('🎵 Populating genre maestros:', genreMaestros.length);

    container.innerHTML = `
        <div class="genre-maestros-grid">
            ${genreMaestros.slice(0, 12).map(maestro => `
                <div class="genre-maestro-card">
                    <div class="maestro-header">
                        <div class="maestro-avatar">
                            ${maestro.avatar ? 
                                `<img src="${maestro.avatar}" alt="${maestro.contributorName}" />` : 
                                `<div class="avatar-placeholder">${maestro.contributorName.charAt(0).toUpperCase()}</div>`
                            }
                        </div>
                        <div class="maestro-info">
                            <h4 class="maestro-name">${maestro.contributorName}</h4>
                            <p class="maestro-title">${maestro.title}</p>
                        </div>
                    </div>
                    <div class="maestro-stats">
                        <div class="stat-row">
                            <span class="stat-label">Tracks</span>
                            <span class="stat-value">${maestro.songCount}/${maestro.totalGenreTracks}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Dominance</span>
                            <span class="stat-value">${maestro.percentage}%</span>
                        </div>
                    </div>
                    <div class="genre-badge">
                        <span class="genre-name">${maestro.genre}</span>
                    </div>
                    ${maestro.tracks && maestro.tracks.length > 0 ? `
                        <div class="maestro-tracks">
                            <p class="tracks-label">Top tracks:</p>
                            ${maestro.tracks.slice(0, 2).map(track => `
                                <div class="track-item">
                                    <span class="track-name">${track.name}</span>
                                    <span class="track-artist">${track.artists}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        
        <div class="maestros-summary">
            <div class="summary-text">
                <i class="fas fa-crown"></i>
                <span>Found ${genreMaestros.length} genre champions across the playlist</span>
            </div>
        </div>
    `;
}

// Populate playlist members section
function populatePlaylistMembers(membersData) {
    const container = document.getElementById('playlist-members');
    if (!container || !membersData) {
        if (container) {
            container.innerHTML = '<p class="no-data">No members data available</p>';
        }
        return;
    }

    console.log('👥 Populating playlist members:', membersData);

    const { contributors, listeners, summary } = membersData;

    container.innerHTML = `
        <div class="members-overview">
            <div class="members-stats">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <span class="stat-number">${summary.totalMembers}</span>
                        <span class="stat-label">Total Members</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎶</div>
                    <div class="stat-info">
                        <span class="stat-number">${summary.contributorCount}</span>
                        <span class="stat-label">Contributors</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎧</div>
                    <div class="stat-info">
                        <span class="stat-number">${summary.listenerCount}</span>
                        <span class="stat-label">Listeners</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="members-sections">
            <div class="contributors-section">
                <div class="section-header">
                    <h4><i class="fas fa-plus-circle"></i> Contributors</h4>
                    <p>People who have added tracks to this playlist</p>
                </div>
                <div class="members-list">
                    ${contributors.map((member, index) => `
                        <div class="member-card contributor">
                            <div class="member-rank">#${index + 1}</div>
                            <div class="member-avatar">
                                ${member.avatar ? 
                                    `<img src="${member.avatar}" alt="${member.name}" />` : 
                                    `<div class="avatar-placeholder">${member.name.charAt(0).toUpperCase()}</div>`
                                }
                                <div class="member-role-badge">${member.icon}</div>
                            </div>
                            <div class="member-info">
                                <h5 class="member-name">${member.name}</h5>
                                <p class="member-role">${member.role}</p>
                                <p class="member-description">${member.description}</p>
                                ${member.followerCount ? `
                                    <p class="member-followers">${member.followerCount.toLocaleString()} followers</p>
                                ` : ''}
                            </div>
                            <div class="member-stats">
                                <div class="stat-item">
                                    <span class="stat-value">${member.tracksAdded}</span>
                                    <span class="stat-label">tracks</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${listeners.count > 0 ? `
                <div class="listeners-section">
                    <div class="section-header">
                        <h4><i class="fas fa-headphones"></i> Listeners</h4>
                        <p>People who follow this playlist</p>
                    </div>
                    <div class="listeners-info">
                        <div class="listeners-count">
                            <span class="count">${listeners.count}</span>
                            <span class="label">estimated listeners</span>
                        </div>
                        <div class="listeners-note">
                            <i class="fas fa-info-circle"></i>
                            <span>${listeners.note}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Load and display members and genre champions
async function loadMembersAndChampions() {
    const playlistId = '1BZY7mhShLhc2fIlI6uIa4';
    
    try {
        console.log('🔍 Loading playlist members and genre champions...');
        
        const accessToken = getCookie('spotify_access_token');
        
        const response = await fetch('/api/playlist/members-and-champions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistId: playlistId,
                accessToken: accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to load members and champions');
        }
        
        const data = await response.json();
        
        // Populate the sections
        populateGenreMaestros(data.genreChampions);
        populatePlaylistMembers(data.members);
        
        console.log('✅ Members and champions loaded successfully');
        
        return data;
        
    } catch (error) {
        console.error('Error loading members and champions:', error);
        
        // Show error state
        const genreMaestrosContainer = document.getElementById('genre-maestros');
        const playlistMembersContainer = document.getElementById('playlist-members');
        
        if (genreMaestrosContainer) {
            genreMaestrosContainer.innerHTML = '<p class="error-message">Failed to load genre champions</p>';
        }
        if (playlistMembersContainer) {
            playlistMembersContainer.innerHTML = '<p class="error-message">Failed to load playlist members</p>';
        }
    }
}
