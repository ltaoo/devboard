import { VideoPlayerCore } from "@/domains/video_player";
import { JSX } from "solid-js/jsx-runtime";

const Root = () => {};

const Video = (props: { store: VideoPlayerCore }) => {
  let $video: undefined | HTMLVideoElement;

  return (
    <video
      ref={$video}
      class="w-full relative z-10"
      controls={true}
      webkit-playsinline="true"
      plays-in-line
      preload="none"
      //       height={height}
    />
  );
};
const Poster = (props: { store: VideoPlayerCore } & JSX.HTMLAttributes<HTMLElement>) => {

};
const Progress = (props: { store: VideoPlayerCore }) => {

};
const CurTime = (props: { store: VideoPlayerCore }) => {

};

const Handler = (props: { store: VideoPlayerCore } & JSX.HTMLAttributes<HTMLElement>) => {

};
