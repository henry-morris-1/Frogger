import Globals from "./Globals.js";
import Model from "./Model.js";

export default class Log extends Model {
    #index;                      // Index of the turtle model
    #lane;                       // Lane in which this turtle swims
    #direction = vec3.create();  // Direction vector

    /**
     * Constructs a turtle in the given lane
     * @param {Number} lane Lane in which to place the turtle
     * @param {Number} offset Number turtle in the given lane
     */
    constructor(lane, offset) {
        // Add the model
        super("../models/turtle.json", `../textures/turtle.png`);

        // Set the model index and lane
        this.#index = Globals.modelSetCount - 1;
        this.#lane = lane;

        // Transform the car
        this.transform(lane, offset);
    }

    /**
     * Gets the row the turtle is in as a z-position.
     * @returns y position of the turtle
     */
    get row() {
        return Globals.modelCenters[this.#index][2];
    }

    /**
     * Gets the bounding x and z values for the turtle.
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
     * Gets whether or not the turtle is above water.
     * @return true if the turtle is above water, false if not
     */
    get aboveWater() {
        return Globals.modelCenters[this.#index][1] > -0.1;
    }

    /**
     * Transforms the turtle model into the given lane.
     * @param {Number} lane Lane in which to place the turtle
     * @param {Number} offset Number turtle in the given lane
     */
    transform(lane, offset) {
        // The model is centered by default, so it just needs to be scaled before it's moved
        mat4.fromScaling(Globals.scale, vec3.fromValues(0.325, 0.25, 0.25));
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.scale, Globals.modelMatrices[this.#index]);
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.scale);

        // Place the turtles in each lane
        // Start by getting a translation vector based on the lane the turtle is in
        if (lane === 1) {
            vec3.set(this.#direction, offset + 9, -0.075, 7.5);
        } else if (lane === 2) {
            vec3.set(this.#direction, offset + 9, -0.075, 10.5);
        }

        mat4.fromTranslation(Globals.translate, this.#direction); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate the model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }

    /**
     * Updates the position of the turtle.
     */
    updatePosition() {
        // Calculate the movement for floating using a cosine wave
        // Only move half the time
        //// Down -> up -> wait, repeat
        let f = (Globals.floatCycle > 31 && Globals.floatCycle < 156) ? 0 : 0.00625 * Math.cos(4 * Math.PI * Globals.floatCycle / 250);

        // Move the frogs and float them up and down
        if (this.#lane === 1) {
            (Globals.modelCenters[this.#index][0] > 13.15) ? vec3.set(this.#direction, -13.8, f, 0) : vec3.set(this.#direction, 0.02845, f, 0);
        } else {
            (Globals.modelCenters[this.#index][0] < -0.65) ? vec3.set(this.#direction, 13.8, f, 0) : vec3.set(this.#direction, -0.02845, f, 0);
        }

        mat4.fromTranslation(Globals.translate, this.#direction); // Get the appropriate translation matrix
        mat4.multiply(Globals.modelMatrices[this.#index], Globals.translate, Globals.modelMatrices[this.#index]); // Translate model matrix
        vec3.transformMat4(Globals.modelCenters[this.#index], Globals.modelCenters[this.#index], Globals.translate); // Translate center
    }
}