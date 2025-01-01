import Globals from "./Globals.js";
import Model from "./Model.js";

export default class Log extends Model {
    #index;                      // Index of the log model
    #lane;                       // Lane in which this log floats
    #direction = vec3.create();  // Direction vector

    /**
     * Constructs a log in the given lane
     * @param {Number} lane Lane in which to place the log
     * @param {Number} offset Number log in the given lane
     */
    constructor(lane, offset) {
        // Add the model
        super("../models/log.json", `../textures/log.png`);

        // Set the model index and lane
        this.#index = Globals.modelSetCount - 1;
        this.#lane = lane;

        // Transform the log
        this.transform(lane, offset);
    }

    /**
     * Gets the row the log is in as a z-position.
     * @returns y position of the log
     */
    get row() {
        return Globals.modelCenters[this.#index][2];
    }

    /**
     * Gets the bounding x and z values for the log.
     * @returns Minium and maximum x and z positions of the model
     */
    get bounds() {
        let center = Globals.modelCenters[this.#index];

        return {
            xMin: center[0] - 2,
            xMax: center[0] + 2,
            zMin: center[2] - 0.5,
            zMax: center[2] + 0.5
        };
    }

    /**
     * Transforms the log model into the given lane.
     * @param {Number} lane Lane in which to place the log
     * @param {Number} offset Number log in the given lane
     */
    transform(lane, offset) {
        // Place the logs in each lane
        // Start by getting a translation vector based on the lane the log is in
        switch (lane) {
            case 1:
                vec3.set(this.#direction, offset * 3, -0.1, 7.5);
                break;
            case 2:
                vec3.set(this.#direction, offset * 5, -0.1, 8.5);
                break;
            case 3:
                vec3.set(this.#direction, offset * 11, -0.1, 9.5);
                break;
            case 4:
                vec3.set(this.#direction, offset * 4, -0.1, 10.5);
                break;
            case 5:
                vec3.set(this.#direction, offset * 7, -0.1, 11.5);
                break;
        }

        mat4.fromTranslation(Globals.translate, this.#direction); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate the model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }

    /**
     * Updates the position of the log.
     */
    updatePosition(deltaTime) {
        // Move the logs in their lanes
        // Calculate the direction to translate based on the lane and x-position
        switch (this.#lane) {
            case 1:
            case 3:
            case 5:
                (Globals.modelCenters[this.#index][0] > 15) ? vec3.set(this.#direction, -17, 0, 0) : vec3.set(this.#direction, 0.0021 * deltaTime, 0, 0);
                break;
            case 2:
            case 4:
                (Globals.modelCenters[this.#index][0] < -2) ? vec3.set(this.#direction, 17, 0, 0) : vec3.set(this.#direction, -0.0021 * deltaTime, 0, 0);
                break;
        }

        mat4.fromTranslation(Globals.translate, this.#direction); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }
}