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