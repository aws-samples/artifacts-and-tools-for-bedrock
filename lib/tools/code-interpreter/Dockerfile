FROM public.ecr.aws/lambda/python:3.12

WORKDIR ${LAMBDA_TASK_ROOT}

RUN dnf install -y gcc tar graphviz xdg-utils libglvnd-glx fontconfig && \
  dnf clean all

RUN curl -LO https://github.com/jgm/pandoc/releases/download/3.2/pandoc-3.2-linux-amd64.tar.gz && \
  tar xvzf pandoc-3.2-linux-amd64.tar.gz --strip-components 1 -C /usr/local && \
  rm pandoc-3.2-linux-amd64.tar.gz

RUN pandoc --version

# Fonts
RUN mkdir -p /usr/share/fonts/arial
RUN mkdir -p /usr/share/fonts/dejavu
RUN ln -f /usr/share/fonts/google-droid-sans-fonts/DroidSans.ttf /usr/share/fonts/arial/arial.ttf
RUN ln -f /usr/share/fonts/google-droid-sans-fonts/DroidSans.ttf /usr/share/fonts/arial/Arial.ttf
RUN ln -f /usr/share/fonts/google-droid-sans-fonts/DroidSans.ttf /usr/share/fonts/dejavu/DejaVuSans.ttf
RUN fc-cache -fv
RUN fc-list | grep "arial"

COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

COPY *.py ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]