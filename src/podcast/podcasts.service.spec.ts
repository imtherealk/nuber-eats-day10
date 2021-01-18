import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Episode } from './entities/episode.entity';
import { Podcast } from './entities/podcast.entity';
import { PodcastsService } from './podcasts.service';

const InternalServerErrorOutput = {
  ok: false,
  error: 'Internal server error occurred.',
};

const episode = { id: 1, title: 'ep1', category: 'ep1', podcastId: 1 };
const podcast = {
  id: 1,
  title: 'test1',
  category: 'test1',
  rating: 3,
  episodes: [episode],
};
const podcastList = [
  { id: 1, title: 'test1', category: 'test1' },
  { id: 2, title: 'test2', category: 'test2' },
];

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  findOneOrFail: jest.fn(),
});

type MockPodcastRepository<T = any> = Partial<
  Record<keyof Repository<Podcast>, jest.Mock>
>;

type MockEpisodeRepository<T = any> = Partial<
  Record<keyof Repository<Episode>, jest.Mock>
>;

describe('PodcastsService', () => {
  let service: PodcastsService;
  let podcastsRepository: MockPodcastRepository<Podcast>;
  let episodesRepository: MockEpisodeRepository<Episode>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PodcastsService,
        {
          provide: getRepositoryToken(Podcast),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Episode),
          useValue: mockRepository(),
        },
      ],
    }).compile();
    service = module.get<PodcastsService>(PodcastsService);
    podcastsRepository = module.get(getRepositoryToken(Podcast));
    episodesRepository = module.get(getRepositoryToken(Episode));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllPodcasts', () => {
    it('should return all podcasts', async () => {
      podcastsRepository.find.mockResolvedValue(podcastList);

      const result = await service.getAllPodcasts();

      expect(podcastsRepository.find).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.find).toHaveBeenCalledWith();

      expect(result).toEqual({ ok: true, podcasts: podcastList });
    });
    it('should fail on exception', async () => {
      podcastsRepository.find.mockRejectedValue(new Error());
      const result = await service.getAllPodcasts();
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('createPodcast', () => {
    const createPodcastArgs = {
      title: 'test-title',
      category: 'test-category',
    };
    it('should create a new podcast', async () => {
      podcastsRepository.create.mockReturnValue(createPodcastArgs);
      podcastsRepository.save.mockResolvedValue({
        ...createPodcastArgs,
        id: 1,
      });
      const result = await service.createPodcast(createPodcastArgs);

      expect(podcastsRepository.create).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.create).toHaveBeenCalledWith(createPodcastArgs);

      expect(podcastsRepository.save).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.save).toHaveBeenCalledWith(createPodcastArgs);

      expect(result).toEqual({ ok: true, id: 1 });
    });

    it('should fail on exception', async () => {
      podcastsRepository.create.mockRejectedValue(new Error());
      const result = await service.createPodcast(createPodcastArgs);
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('getPodcast', () => {
    it('should return a podcast', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.getPodcast(podcast.id);

      expect(podcastsRepository.findOne).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.findOne).toHaveBeenCalledWith(
        {
          id: podcast.id,
        },
        { relations: ['episodes'] },
      );

      expect(result).toEqual({ ok: true, podcast });
    });
    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.getPodcast(999);

      expect(podcastsRepository.findOne).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.findOne).toHaveBeenCalledWith(
        {
          id: 999,
        },
        { relations: ['episodes'] },
      );

      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });
    it('should fail on exception', async () => {
      podcastsRepository.findOne.mockRejectedValue(new Error());
      const result = await service.getPodcast(999);
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('deletePodcast', () => {
    it('should delete a podcast', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      podcastsRepository.delete.mockResolvedValue(expect.any(Object));

      const result = await service.deletePodcast(podcast.id);

      expect(podcastsRepository.delete).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.delete).toHaveBeenCalledWith({
        id: podcast.id,
      });

      expect(result).toEqual({ ok: true });
    });
    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.deletePodcast(999);

      expect(podcastsRepository.delete).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });
    it('should fail on exception', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      podcastsRepository.delete.mockRejectedValue(new Error());

      const result = await service.deletePodcast(999);

      expect(podcastsRepository.delete).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.delete).toHaveBeenCalledWith({
        id: 999,
      });
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('updatePodcast', () => {
    const updateTitleCategoryPayload = {
      title: 'new-title',
      category: 'new-category',
    };
    const updateRatingPayload = { rating: 5 };

    it('should update title and category', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      podcastsRepository.save.mockResolvedValue({
        ...podcast,
        ...updateTitleCategoryPayload,
      });

      const result = await service.updatePodcast({
        id: podcast.id,
        payload: updateTitleCategoryPayload,
      });

      expect(podcastsRepository.save).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.save).toHaveBeenCalledWith({
        ...podcast,
        ...updateTitleCategoryPayload,
      });

      expect(result).toEqual({ ok: true });
    });

    it('should update rating', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      podcastsRepository.save.mockResolvedValue({
        ...podcast,
        ...updateRatingPayload,
      });

      const result = await service.updatePodcast({
        id: podcast.id,
        payload: updateRatingPayload,
      });

      expect(podcastsRepository.save).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.save).toHaveBeenCalledWith({
        ...podcast,
        ...updateRatingPayload,
      });

      expect(result).toEqual({ ok: true });
    });

    it('should fail if rating > 5 or rating < 1', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.updatePodcast({
        id: podcast.id,
        payload: { rating: 10 },
      });

      expect(podcastsRepository.save).toHaveBeenCalledTimes(0);

      expect(result).toEqual({
        ok: false,
        error: 'Rating must be between 1 and 5.',
      });
    });

    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.updatePodcast({
        id: 999,
        payload: updateTitleCategoryPayload,
      });

      expect(podcastsRepository.save).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });

    it('should fail on exception', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      podcastsRepository.save.mockRejectedValue(new Error());

      const result = await service.updatePodcast({
        id: podcast.id,
        payload: updateTitleCategoryPayload,
      });

      expect(podcastsRepository.save).toHaveBeenCalledTimes(1);
      expect(podcastsRepository.save).toHaveBeenCalledWith({
        ...podcast,
        ...updateTitleCategoryPayload,
      });
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('getEpisodes', () => {
    it('should get episodes of the podcast', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.getEpisodes(podcast.id);

      expect(result).toEqual({ ok: true, episodes: podcast.episodes });
    });
    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.getEpisodes(999);

      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });
  });

  describe('getEpisode', () => {
    it('should get the episode', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.getEpisode({
        podcastId: podcast.id,
        episodeId: episode.id,
      });

      expect(result).toEqual({ ok: true, episode });
    });

    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.getEpisode({
        podcastId: 999,
        episodeId: episode.id,
      });

      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });

    it("should fail if episode doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.getEpisode({
        podcastId: podcast.id,
        episodeId: 999,
      });

      expect(result).toEqual({
        ok: false,
        error: `Episode with id 999 not found in podcast with id ${podcast.id}`,
      });
    });
  });

  describe('createEpisode', () => {
    const createEpisodeArgs = {
      title: 'test-title',
      category: 'test-category',
    };
    const newEpisodeId = 2;
    it('should create a new episode', async () => {
      podcastsRepository.findOne.mockReturnValue(podcast);
      episodesRepository.create.mockReturnValue(createEpisodeArgs);
      episodesRepository.save.mockResolvedValue({
        podcast,
        ...createEpisodeArgs,
        id: newEpisodeId,
      });

      const result = await service.createEpisode({
        ...createEpisodeArgs,
        podcastId: podcast.id,
      });

      console.log(createEpisodeArgs);

      expect(episodesRepository.create).toHaveBeenCalledTimes(1);
      expect(episodesRepository.create).toHaveBeenCalledWith({
        title: createEpisodeArgs.title,
        category: createEpisodeArgs.category,
      });

      expect(episodesRepository.save).toHaveBeenCalledTimes(1);
      expect(episodesRepository.save).toHaveBeenCalledWith(createEpisodeArgs);

      expect(result).toEqual({ ok: true, id: newEpisodeId });
    });

    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createEpisode({
        ...createEpisodeArgs,
        podcastId: 999,
      });

      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });

    it('should fail on exception', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      episodesRepository.create.mockRejectedValue(new Error());
      const result = await service.createEpisode({
        ...createEpisodeArgs,
        podcastId: podcast.id,
      });

      expect(episodesRepository.create).toHaveBeenCalledTimes(1);
      expect(episodesRepository.create).toHaveBeenCalledWith({
        title: createEpisodeArgs.title,
        category: createEpisodeArgs.category,
      });
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('deleteEpisode', () => {
    it('should delete a episode', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      episodesRepository.delete.mockResolvedValue(expect.any(Object));

      const result = await service.deleteEpisode({
        podcastId: podcast.id,
        episodeId: episode.id,
      });

      expect(episodesRepository.delete).toHaveBeenCalledTimes(1);
      expect(episodesRepository.delete).toHaveBeenCalledWith({
        id: episode.id,
      });

      expect(result).toEqual({ ok: true });
    });
    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.deleteEpisode({
        podcastId: 999,
        episodeId: episode.id,
      });

      expect(episodesRepository.delete).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });
    it("should fail if episode doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.deleteEpisode({
        podcastId: podcast.id,
        episodeId: 999,
      });

      expect(podcastsRepository.delete).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        ok: false,
        error: `Episode with id 999 not found in podcast with id ${podcast.id}`,
      });
    });
    it('should fail on exception', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      episodesRepository.delete.mockRejectedValue(new Error());

      const result = await service.deleteEpisode({
        podcastId: podcast.id,
        episodeId: episode.id,
      });

      expect(episodesRepository.delete).toHaveBeenCalledTimes(1);
      expect(episodesRepository.delete).toHaveBeenCalledWith({
        id: episode.id,
      });
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });

  describe('updateEpisode', () => {
    const updateTitleCategoryPayload = {
      title: 'new-title',
      category: 'new-category',
    };
    it('should update title and category', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      episodesRepository.save.mockResolvedValue({
        ...podcast,
        ...updateTitleCategoryPayload,
      });

      const result = await service.updateEpisode({
        podcastId: podcast.id,
        episodeId: episode.id,
        ...updateTitleCategoryPayload,
      });

      expect(episodesRepository.save).toHaveBeenCalledTimes(1);
      expect(episodesRepository.save).toHaveBeenCalledWith({
        ...episode,
        ...updateTitleCategoryPayload,
      });

      expect(result).toEqual({ ok: true });
    });

    it("should fail if podcast doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(undefined);

      const result = await service.updateEpisode({
        podcastId: 999,
        episodeId: episode.id,
        ...updateTitleCategoryPayload,
      });

      expect(episodesRepository.save).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        ok: false,
        error: `Podcast with id 999 not found`,
      });
    });
    it("should fail if episode doesn't exist", async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);

      const result = await service.updateEpisode({
        podcastId: podcast.id,
        episodeId: 999,
        ...updateTitleCategoryPayload,
      });

      expect(podcastsRepository.save).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        ok: false,
        error: `Episode with id 999 not found in podcast with id ${podcast.id}`,
      });
    });

    it('should fail on exception', async () => {
      podcastsRepository.findOne.mockResolvedValue(podcast);
      episodesRepository.save.mockRejectedValue(new Error());

      const result = await service.updateEpisode({
        podcastId: podcast.id,
        episodeId: episode.id,
        ...updateTitleCategoryPayload,
      });

      expect(episodesRepository.save).toHaveBeenCalledTimes(1);
      expect(episodesRepository.save).toHaveBeenCalledWith({
        ...episode,
        ...updateTitleCategoryPayload,
      });
      expect(result).toEqual(InternalServerErrorOutput);
    });
  });
});
