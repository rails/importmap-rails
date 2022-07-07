import { Component } from "react";

export default class Clock extends Component {
  render() {
    return (
      <div>
        <h1>UNIX Clock</h1>
        <p>The current UNIX date is {Date.now()}.</p>
      </div>
    );
  }
}
