// GEMINI.3 ball-memory.js

// Private dictionary mapping coordinate string keys to structural traversal counts
const traversalWeights = {};

export const BallMemorySystem = {
  /**
   * Generates a unique tracking key for a specific environmental decision point.
   * @param {string} hallId - The current structural Hall ID (e.g., "H1") or "FAKE"
   * @param {number} globalX - The absolute global X coordinate of the intersection
   * @param {string} direction - The target cardinal navigation vector
   * @returns {string} Composed data tracking key
   */
  generateKey(hallId, globalX, direction) {
    return `${hallId}_X${globalX.toFixed(1)}_${direction}`;
  },

  /**
   * Retrieves the number of times the ball has traversed a specific path link.
   * Unexplored pathways default safely to a weight score of 0.
   */
  getWeight(key) {
    return traversalWeights[key] || 0;
  },

  /**
   * Increments the weight index of a link once a threshold gate has been successfully breached.
   */
  incrementWeight(key) {
    if (!traversalWeights[key]) {
      traversalWeights[key] = 0;
    }
    traversalWeights[key]++;
  }
};
